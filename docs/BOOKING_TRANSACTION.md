# Booking Transaction (M2)

Status: **IMPLEMENTED NOT VERIFIED** against live Google/Supabase. Logic VERIFIED with fakes and against a real local Postgres 16 — see `duck/VERIFICATION_LEDGER.md`.

Code: `src/core/booking/service.ts` (orchestration, provider-neutral) · `src/core/booking/store.ts` (port) · `src/server/db/booking-store.ts` (Postgres) · `src/core/integrations/calendar/google.ts` (Google adapter).

## Principles
- **DB is booking truth, calendar is availability truth.** The Google event mirrors a DB booking; Google free/busy decides what is free.
- **Never claim success before the calendar confirms.** A visitor only sees "You're booked" after the provider accepted the event *and* the DB recorded it.
- **Every write is idempotent.** Visitor retries use the same idempotency key; Google events use a deterministic client-supplied ID derived from the booking ID, so a retried insert returns `409` instead of creating a duplicate.
- **AI is not involved.** Nothing below imports or calls the AI layer.

## The sequence

| # | Step | Where | Failure handling |
|---|---|---|---|
| 1 | Visitor requests available slots for a date range (≤31 days). | `GET /api/public/{slug}/availability` → `listSlots` | Unknown slug → 404. Range invalid → 400. |
| 2 | Read connected-calendar busy periods (live Google free/busy, range widened by buffers) **plus** occupied DB rows (unexpired holds, pending/confirmed bookings). | `GoogleCalendarAdapter.getBusy`, `store.occupiedIntervals` | Google unavailable/auth error → **fail closed**: `503 calendar_unavailable`. No slots are guessed. |
| 3 | Apply weekly hours (host IANA timezone, DST-safe), duration, buffers, minimum notice, horizon. | `generateSlots` (pure) | — |
| 4 | Visitor selects a slot. | Browser | — |
| 5 | Create a short-lived DB **hold** (default 10 min). Slot must be one the policy offers *now*. In the same transaction, the host's expired holds are swept; the insert is protected by the `bookings_no_overlap` exclusion constraint. | `POST /api/public/holds` → `createHold` | Overlap → `409 slot_unavailable`. Off-policy time → `400 invalid_slot`. |
| 6 | Visitor submits name/email. **Re-check live availability** for the buffered interval against Google free/busy and other DB rows (excluding this hold). Re-check policy (minimum notice may have passed). | `POST /api/public/bookings` → `confirm` | Conflict → release hold, `409 slot_unavailable`. Google unreachable → keep hold, `503 calendar_unavailable` (retryable). Hold expired → `410 hold_expired`. |
| 7 | **Atomically convert the hold into a booking** (`held → pending_event`), row-locked, storing visitor details and the idempotency key (unique per host). | `store.convertHold` (single transaction, `SELECT … FOR UPDATE`) | Same key already used → return that booking (idempotent replay). Hold gone/expired → 404/410. |
| 8 | Create the Google Calendar event with ID = booking UUID hex, attendee = visitor, `sendUpdates=all`, management link in the description. | `GoogleCalendarAdapter.createEvent` | See compensation below. |
| 9 | Persist external event ID/URL and set `confirmed`. | `store.transition(pending_event|needs_reconciliation → confirmed)` | DB failure → see "crash windows". |
| 10 | Return confirmation (exact date/time/timezone + manage link). | `201` (first) / `200` (duplicate) | — |

## State machine (`bookings.status`)

```
held ──(confirm)──▶ pending_event ──(event created + persisted)──▶ confirmed ──(cancel)──▶ cancelled
 │                      │  ├─(provider definitely rejected, first attempt)──▶ failed      (slot released)
 │                      │  └─(outcome unknown: timeout/5xx/network)─────────▶ needs_reconciliation
 │                      │                                                       │  (slot stays reserved)
 │                      └─(crash; resumed after 60 s by same key or host)       └─(retry: visitor or host)──▶ confirmed
 ├─(expiry)──▶ expired      ├─(visitor goes back)──▶ released      └─(used by reschedule)──▶ consumed
```

Slot-occupying statuses (DB exclusion constraint + `SLOT_OCCUPYING_STATUSES`): `held`, `pending_event`, `confirmed`, `needs_reconciliation`.

## Compensation for partial failures

| Situation | What we know | Action | Visitor sees |
|---|---|---|---|
| Google rejects the insert (400/401/403/404/429) on the **first** attempt | No event exists | `failed`, slot released | "The calendar did not accept the booking. Nothing was booked." (`502`) |
| Insert times out / 5xx / network error | Event **may** exist | `needs_reconciliation`, slot **kept** | "Your time is reserved, but the calendar hasn't confirmed it yet. You are **not booked** until it does. Try again." (`202`) |
| Retry of a `needs_reconciliation` booking (same key) | Deterministic ID | Insert again → `409` → fetch existing → PATCH to DB time → `confirmed` | "You're booked" |
| Definite error on a **retry** | An earlier attempt may have created the event | Stays `needs_reconciliation` (never `failed`) | "Not booked yet; try again" |
| Event created, DB write of `confirmed` fails | Event exists, DB `pending_event` | Marked `needs_reconciliation` if that write works; otherwise remains `pending_event` | 202, or 500 "Something went wrong. Please try again; retrying is safe." |
| Process crashes between steps 7 and 9 | DB `pending_event` | Same key after 60 s, or host **Retry**, resumes from step 8 | "Being confirmed…" then confirmed |
| Event deleted by the host in Google before a retry | `409` + event `status=cancelled` | Treated as rejected → booking stays unconfirmed for the host to resolve | Not booked |

### Reconciliation strategy
- **Visitor-driven:** the 202 screen has a *Try again* button that re-posts the same idempotency key.
- **Host-driven:** the dashboard lists `needs_reconciliation` / `pending_event` bookings with **Retry** (calls `BookingService.reconcile`) and **Cancel**.
- Reconcile = idempotent insert (deterministic ID) + PATCH the event to the DB time. It is safe to run any number of times.
- No background worker in V0 (per CONSTRAINTS: no queue on the critical path). OPEN QUESTION for M6: a scheduled sweep that reconciles or alerts on bookings stuck > N minutes.

## Cancellation
Calendar first, then DB: `DELETE` the event (404/410 = already gone = success) → `cancelled`. If Google fails, the booking is **unchanged** and the visitor/host is told to retry. Cancelling twice is a no-op.

## Reschedule
1. Visitor (manage link) picks a new slot → normal hold (step 5).
2. Re-check Google for the new buffered interval, **subtracting the booking's own current interval** (its own event shows as busy).
3. PATCH the Google event (start/end).
4. One DB transaction: hold → `consumed`, booking moved to the new time. The old interval is released by the same transaction.

Failures: definite Google error → hold released, original time unchanged. Unknown outcome → booking `needs_reconciliation`, hold kept for retry; reconciliation PATCHes Google back to the DB time if abandoned. Calendar moved but DB move failed → `needs_reconciliation` (reconcile restores the DB time on Google).

V0 limitation (ASSUMPTION, acceptable): rescheduling onto a time that **overlaps** the current booking is rejected (the hold would overlap the booking it replaces). Adjacent and buffer-overlapping moves work.

## Concurrency guarantees
- Slot-claiming writes for one host (`createHold`, `convertHold`, `moveToHold`) take a transaction-scoped advisory lock (`pg_advisory_xact_lock`, safe with Supabase's transaction pooler). Deadlocks and serialization failures are retried. Without the lock, concurrent exclusion-constraint inserts deadlocked intermittently (observed 40P01).
- Two visitors, same slot: the Postgres exclusion constraint admits exactly one hold (VERIFIED locally: 20 concurrent holds → 1 success; 10 concurrent full bookings → 1 confirmed booking, 1 event).
- Double-click / duplicate submission: unique `(host_id, idempotency_key)` + row lock; the loser receives the winner's booking or `in_progress` (client auto-retries).
- Buffers between two *simultaneous* bookings are enforced at re-check, not by the DB constraint (raw overlap only). A narrow race could place two bookings closer than the buffer, never overlapping. ASSUMPTION acceptable for V0.
- External calendar writes (the host adds an event in Google between re-check and insert) can still race in a window of milliseconds. Documented in SYSTEM_DESIGN; measure before scale.

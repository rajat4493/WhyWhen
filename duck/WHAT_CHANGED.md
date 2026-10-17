# What Changed
## Bootstrap
- HUMAN: direct calendar booking explicitly included in V0.
- HUMAN: multiple AI/model/API options required.
- HUMAN: MCP + Gmail/Outlook/Zoho-style integration architecture required.
- HUMAN: minimalist design and easy hosting required.
- THEDUCK-SUGGESTED: AI removed from booking critical path.
- THEDUCK-SUGGESTED: live free/busy chosen before calendar synchronization.
- IMPLEMENTATION-NECESSARY: DB interval holds + idempotency for booking safety.

## M1 closure
- IMPLEMENTATION-NECESSARY: dependencies pinned to exact versions; `npm ci` in CI/Docker; broken bootstrap `scripts/verify-core.sh` removed (duplicated `npm run verify`).
- EVIDENCE-DISCOVERED: mock AI adapter signature mismatch and over-broad meeting regex ("consulting" ⇒ meeting) fixed.

## M2 — Google Calendar real booking
- HUMAN: booking sequence order fixed as hold → live re-check → atomic hold→booking → event creation → persist event ID → confirm (replaces the bootstrap order in SYSTEM_DESIGN, which created the event before persisting the booking).
- HUMAN: public page copy "What do you need?" / "Book a time directly".
- IMPLEMENTATION-NECESSARY: `bookings` + `booking_holds` replaced by ONE lifecycle table (`0002` migration). Two tables could not stop a hold overlapping a confirmed booking with a single constraint. 0001 tables were never written or applied, so they were dropped.
- IMPLEMENTATION-NECESSARY: Postgres accessed with `pg` over a server-only `DATABASE_URL` instead of `supabase-js`. This gives real transactions and row locks, and makes the race tests runnable on any Postgres. `@supabase/supabase-js` removed. Supabase anon/service-role keys unused. RLS enabled with no policies to close Supabase's REST exposure. Still Supabase-hosted and portable.
- IMPLEMENTATION-NECESSARY: added `needs_reconciliation` booking state + host **Retry**. The calendar outcome can be unknown (timeouts), and the product must not claim success or silently release a slot.
- IMPLEMENTATION-NECESSARY: calendar adapter contract extended with `listCalendars`, `rescheduleEvent`, `EventRef` and typed `CalendarProviderError` ("definitely not applied" vs "unknown"). Microsoft/Zoho got M4 stubs only; no M4 work started.
- IMPLEMENTATION-NECESSARY: visitor manage links are HMAC capability URLs (no visitor accounts).
- IMPLEMENTATION-NECESSARY: home page demo links (`/demo`) replaced with "Set up your page" → `/dashboard`; demo availability/booking stub endpoints removed.
- ASSUMPTION: `calendar.freebusy` scope authorizes `freeBusy.query` (couldn't fetch Google's reference from the build sandbox). Overridable via `GOOGLE_OAUTH_SCOPES` without a code change.
- ASSUMPTION: rescheduling onto a time overlapping the current booking is unsupported in V0 (rejected cleanly).
- ASSUMPTION: in-memory per-instance rate limits are an acceptable boundary until open launch (M6).

### Change Proposals awaiting human approval
- **CP-M2-1 — Google is the host identity in V0.** USER_FLOWS says "Sign in → slug → connect calendar". M2 merges sign-in and calendar connection into one Google OAuth step (no separate auth system). Proposed provenance: IMPLEMENTATION-NECESSARY. Impact: a host must have a Google account until M4 adds other providers or a separate sign-in.
- **CP-M2-2 — Slug is auto-generated, not chosen.** The slug comes from the email local part (with collision suffix and reserved words avoided) and is shown on the dashboard. A slug editor is deferred. Impact: low; one form field to add if wanted.

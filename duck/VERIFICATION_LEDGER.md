# Verification Ledger

Evidence labels: VERIFIED · IMPLEMENTED NOT VERIFIED · ASSUMPTION · OPEN QUESTION · FAILED.
"VERIFIED (local)" = observed in the build sandbox, not against live Google or Supabase.

## Current state (2026-10-17, M2 approved; M2.1 pending)

| Item | State | Evidence |
|---|---|---|
| Product intent documented | VERIFIED | Scaffold files created |
| TheDuck agent contract included | VERIFIED | `CLAUDE.md`, `AGENTS.md`, `/duck` |
| **M1** install / typecheck / tests / build | VERIFIED | Clean `rm -rf node_modules .next && npm ci && npm run verify` → exit 0 (pinned toolchain) |
| Dependencies pinned, lockfile-exact installs | VERIFIED | Exact versions in `package.json`, `.npmrc save-exact`, `npm ci` in CI + Dockerfile |
| Unit/integration tests (fakes) | VERIFIED (local) | Vitest: 10 files, 98 tests passed (+11 DB tests skipped without `TEST_DATABASE_URL`) |
| Real-Postgres tests | VERIFIED (local) | `npm run test:db` on PostgreSQL 16.15: 11/11 passed (10 consecutive runs, 0 failures, after the slug change); earlier 80 runs, 0 failures after the deadlock fix (migrations, RLS, races, holds, idempotency, reschedule, encryption) |
| Production build | VERIFIED (local) | `next build`: 17 routes compiled |
| Timezone conversion + DST gap/overlap | VERIFIED (local) | `tests/timezone.test.ts`, `tests/policy.test.ts` (Warsaw/Kolkata/New York; 2026-03-29 and 2026-10-25 transitions) |
| Busy exclusion, buffers, minimum notice, horizon | VERIFIED (local) | `tests/policy.test.ts`, `tests/booking-service.test.ts` |
| Two users booking the same slot | VERIFIED (local) | Real Postgres: 20 concurrent holds → exactly 1; 10 concurrent full hold+confirm → 1 confirmed row, 1 calendar event. In-memory: same. Live HTTP smoke: second hold → 409 |
| Hold expiry | VERIFIED (local) | Service + Postgres tests: expired hold rejected (410), swept, slot re-holdable |
| Duplicate request / idempotency | VERIFIED (local) | Same key → same booking, one `createEvent`; concurrent double-click → one event; unique `(host_id, idempotency_key)` on Postgres; UI re-sends the same key on retry (Playwright) |
| Reschedule releases old slot | VERIFIED (local) | Service + Postgres `moveToHold` tests |
| Cancellation | VERIFIED (local) | Calendar first then DB; Google failure leaves booking unchanged (unit + live smoke against Google 401) |
| Provider failure / partial failure compensation | VERIFIED (local) | definite → `failed` + slot released; unknown → `needs_reconciliation` + slot kept; retry with deterministic ID → one event; crash-resume after 60 s; definite error on retry keeps the slot |
| OAuth state validation | VERIFIED (local) | Unit: mismatch/tampered/foreign-purpose/expired/missing rejected. Live smoke: forged `state` → `/dashboard?error=state` |
| OAuth start (PKCE S256, offline, consent, HttpOnly state cookie) | VERIFIED (local) | Live smoke: 307 to accounts.google.com with expected params; `Set-Cookie … HttpOnly; SameSite=lax` |
| Expired token refresh path | VERIFIED (local) | `tests/oauth.test.ts`: refresh, refresh-before-expiry margin, keeps refresh token, `invalid_grant` → revoked, transient → kept |
| Token encryption at rest / host binding | VERIFIED (local) | AES-256-GCM round-trip; ciphertext moved to another host fails; real Postgres column contains no plaintext; disconnect wipes |
| Cross-host isolation | VERIFIED (local) | Host cancel/reconcile ownership tests; host repo keyed by session host id; forged session → sign-in page; cross-origin disconnect → 403 |
| Manage-link forgery | VERIFIED (local) | Forged MAC / MAC moved to another id → 404 (page and API) |
| Public input validation | VERIFIED (local) | zod tests + live smoke (`{"holdId":"x"}` → 400) |
| Rate limiting boundary | VERIFIED (local) | Live smoke: 11th hold request/min/IP → 429. Per-instance only (see ASSUMPTION) |
| Secrets not logged | VERIFIED (local) | Live smoke server log: 0 occurrences of token/secret/session values; redaction unit test |
| Busy-event details never reach visitor | VERIFIED (local) | Availability response keys = `ok, slots, durationMinutes, hostTimezone` |
| AI unavailable while direct booking works | VERIFIED (local) | AI adapter throws (openai-compatible without config, gateway) while booking confirms; `/api/intent` returns degraded message |
| Visitor UI flow (date → time → details → confirm → success; 202 "not booked") | VERIFIED (local) | Playwright Chromium 390×844, API intercepted: times in visitor zone, exact summary, 202 copy says "not booked", retry → success, no page errors |
| Mobile: no horizontal scroll, visible focus | VERIFIED (local) | Playwright 360 px: `/`, `/<slug>`, `/<slug>/book`, `/dashboard` scrollWidth = 360; focus outline solid |
| Host dashboard settings save (server action → DB) | VERIFIED (local) | Playwright: duration 45, buffer 10, Saturday off → DB row updated |
| Google adapter request/response mapping | VERIFIED (local) | Fake-fetch tests (deterministic ID, 409→existing, cancelled→rejected, 401/403/404/429/5xx/network, free/busy normalization, calendar list) |
| Google free/busy endpoint reachable, 401 mapped | VERIFIED (local, partial) | Live smoke with a fake token: Google returned `401 authError`; app failed closed (503) and kept the hold |
| Host-chosen slug (CP-M2-2 replacement) | VERIFIED (local) | `tests/slug.test.ts` (suggestion from display name, diacritics, fallbacks; characters/length/reserved). Real Postgres: new host has no slug/public page, suggestion skips taken (`rajat-2`), `taken`/`already_set`, 5 concurrent claims → exactly 1. Playwright 360 px: suggested `rajat-pandey-2` when `rajat-pandey` taken; `dashboard` rejected server-side as reserved; taken rejected with input kept; `rajat` accepted → public `/rajat` 200; no horizontal scroll |
| **M2.1 primary criterion** (visitor books from real Google availability; real event/invitation) | IMPLEMENTED NOT VERIFIED | Waiting on human-configured Google + Supabase credentials |
| **Google OAuth with real credentials** | IMPLEMENTED NOT VERIFIED | Needs human UAT (`docs/M2_SETUP_AND_UAT.md` steps 1–3) |
| **Supabase** (migrations on Supabase, pooler, TLS) | IMPLEMENTED NOT VERIFIED | Migrations verified on vanilla Postgres 16 only |
| **Real Google event creation / reschedule / cancel** | IMPLEMENTED NOT VERIFIED | UAT steps 7–15 |
| Real token refresh / revocation against Google | IMPLEMENTED NOT VERIFIED | UAT steps 17–18 |
| `calendar.freebusy` scope sufficient for freeBusy.query | ASSUMPTION | Google docs unreachable from sandbox; overridable via `GOOGLE_OAUTH_SCOPES` |
| Client-chosen event ID format (UUID hex) accepted by Google | ASSUMPTION | Matches Google's documented base32hex rule as recalled; first real booking will confirm |
| Per-instance in-memory rate limits sufficient pre-launch | ASSUMPTION | Must move to shared store before open launch (M6) |
| Reschedule onto overlapping time unsupported | ASSUMPTION | Rejected cleanly (test); acceptable V0 limitation |
| Buffer race between two simultaneous bookings | ASSUMPTION | Never overlaps (DB constraint); may violate buffer in a narrow race |
| Background reconciliation sweep | OPEN QUESTION | Not built (no queue in V0); host Retry + visitor retry exist |
| Server-side session revocation | OPEN QUESTION | Stateless cookies; rotation of `SESSION_SECRET` is the kill switch |
| Safari + `Secure` cookies on `http://localhost` in production mode | OPEN QUESTION | Use `npm run dev` locally or HTTPS |
| Microsoft adapter | IMPLEMENTED NOT VERIFIED | No live test (M4); reschedule/list stubs |
| Zoho adapter | IMPLEMENTED NOT VERIFIED | Normalization deliberately gated (M4) |
| AI Gateway mode | OPEN QUESTION | M3 |
| MCP | OPEN QUESTION | M5 |
| Production readiness | FAILED | Live provider evidence, shared rate limits, monitoring and M6 hardening outstanding |

## History

### Bootstrap environment evidence
- `curl https://registry.npmjs.org/next` failed with DNS resolution error in the execution sandbox, so npm install/typecheck/Vitest/build were unverified there.

### M1 verification (networked machine)
- `npm install`: 81 packages, 0 vulnerabilities.
- Initial `npm run verify` FAILED: TS2554 in `registry.ts` and `ai-mock.test.ts` (`MockIntentAdapter.decide` did not accept the config arg the interface requires). FIXED: optional `_config` param.
- Second run: 1 Vitest FAILURE: "What is your consulting rate?" classified as needing a meeting (regex `consult` matched "consulting"). FIXED: word-boundary regex.
- Final `npm run verify`: typecheck, 7/7 tests, production build all pass.
- `scripts/verify-core.sh` FAILED under TypeScript 7.0.2 (TS5112). It duplicated `npm run verify`, so it was REMOVED.

### M1 reproducibility closure
- All dependencies pinned to exact installed versions; `.npmrc save-exact=true`; lockfile committed; CI + Dockerfile use `npm ci`.
- VERIFIED: `rm -rf node_modules .next && npm ci && npm run verify` → exit 0; 7 tests; build OK.
- `tsconfig.tsbuildinfo` removed from git and ignored.

### M2 implementation evidence (2026-10-17)
Toolchain: Node 22.22.0, next 16.4.2, typescript 7.0.2, vitest 5.0.5, pg 8.23.1, PostgreSQL 16.15, Playwright 1.56.1 Chromium.
- `rm -rf node_modules .next && npm ci` → exit 0, 0 vulnerabilities.
- `npm run verify` → exit 0. Vitest 9 files / 95 passed (+10 skipped DB tests). Build compiled 17 routes.
- `npm run test:db` (local PostgreSQL 16.15) → 10/10 passed.
- Live smoke: `next start` with real local Postgres, dummy Google client, fake access token. Observed: OAuth redirect + PKCE + HttpOnly state cookie; forged state rejected; unknown slug 404; availability 503 after Google returned 401 for the fake token; hold 201; duplicate hold 409; confirm 503 with hold kept `held`; release → `released`; bad input 400; forged session → sign-in; cross-origin disconnect 403; 11th hold/min → 429; 0 secrets in log.
- Playwright: booking flow with intercepted API (incl. 202 → retry with same key → success); dashboard save → DB; manage cancel with Google failing → "unchanged" message, DB still `confirmed`; forged manage link → 404; no horizontal scroll at 360 px.
- Defects found and fixed during M2 verification (EVIDENCE-DISCOVERED):
  1. Concurrent double-click returned `hold_not_found` to the loser → now re-checks idempotency key and returns the winner's booking.
  2. Hold creation applied buffers against the booking being rescheduled, blocking adjacent reschedules → buffers moved to the re-check (which excludes the booking itself).
  3. A definite provider error on a *retry* would have released a slot whose event might exist → stays `needs_reconciliation`.
  4. Weekly hours ending at midnight (`24:00`) could not round-trip through `<input type=time>`, so saving failed → 00:00 end maps to 24:00.
  5. Dashboard overflowed horizontally on phones (time inputs) → grid `minmax(0,1fr)`.
  6. Empty `KEY=` env lines (e.g. `GOOGLE_OAUTH_SCOPES=`) would have requested zero scopes / failed TTL parsing → treated as unset.
  7. Invalid `APP_ENCRYPTION_KEY` surfaced as a 500 → now a configuration error (503 "not configured").
  8. **Postgres deadlock (40P01) under concurrent same-slot holds.** Intermittent (2 failures in ~32 runs of the 10-visitor race). Cause: concurrent inserts checked by the exclusion constraint waited on each other's uncommitted rows. FIXED: per-host transaction-scoped advisory lock for slot-claiming writes (`createHold`, `convertHold`, `moveToHold`) + transaction retry on 40P01/40001. After the fix: 40 consecutive `npm run test:db` runs with the lock on `createHold`/`moveToHold`, then 40 more after extending it to `convertHold`/transitions: **80 runs, 0 failures.**

### Slug decision implementation (2026-10-17)
- CP-M2-1 approved (HUMAN). CP-M2-2 replaced by host-chosen slug (HUMAN); migration `0003` (nullable slug).
- `npm run verify` → exit 0: 10 test files / 98 passed (+11 DB skipped); typecheck clean; build compiled.
- `npm run test:db` → 11/11, run 10 times consecutively, 0 failures.
- Live smoke (`next start`, local Postgres, dummy Google): first-time "Choose your link" flow observed as listed in the table.

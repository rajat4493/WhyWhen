# Handoff

## Current milestone
**M2.1 — Real Google booking verification: NOT STARTED, waiting on human-configured credentials.**
Success criterion: an unauthenticated visitor opens the host's public WhyWhen URL, sees availability from the host's real Google Calendar, books a slot, and a real Google Calendar event/invitation is created. Procedure: `docs/M2_SETUP_AND_UAT.md`. No new product features (no Outlook/Microsoft, Zoho, Gmail, MCP expansion, payments, teams, analytics, AI enhancements) before M2.1 passes.

M2 — Google Calendar real booking: IMPLEMENTED NOT VERIFIED, human-approved (CP-M2-1 approved; CP-M2-2 replaced by host-chosen slug, implemented).

M1: VERIFIED.

## Product truth
Read `docs/PRODUCT_INTENT_LOCKED_V1.md`. Booking transaction: `docs/BOOKING_TRANSACTION.md`.

## What exists (M2)
- Google OAuth: PKCE + signed state cookie, scope check, offline access, encrypted token storage (AES-256-GCM, AAD = host), refresh with revocation detection, disconnect with revoke at Google. Sign-in = connect (CP-M2-1, APPROVED).
- First-time setup "Choose your link": slug suggested from the Google display name, editable, validated (characters/reserved/unique), set once (`src/core/hosts/slug.ts`, `claimSlug`, migration `0003`). No later editing/history/redirects in V0.
- Host dashboard: connect/disconnect, calendar choice (owned calendars), timezone, weekly hours, duration, buffers, minimum notice, horizon, upcoming bookings with Cancel/Retry, sign out.
- Public: `/{slug}` ("What do you need?" / "Book a time directly"), `/{slug}/book` (date → time → name/email → confirm → success), `/manage/{token}` (reschedule/cancel).
- Booking service (provider-neutral) implementing the 10-step sequence with holds, live re-check, atomic conversion, deterministic Google event IDs, `needs_reconciliation` compensation, cancel, reschedule.
- Postgres store via `pg` + migration `0002` (single lifecycle table, exclusion constraint, RLS on).
- Rate limits, input validation, redacted logging, CI with a Postgres service.

## Verified locally (see ledger for exact evidence)
`npm ci && npm run verify` (98 tests + build) · `npm run test:db` (11 real-Postgres tests incl. 20-way race and concurrent slug claims) · live HTTP smoke · Playwright UI flows at phone width.

## Explicitly NOT verified
Real Google OAuth consent, token refresh/revocation against Google, real event create/reschedule/cancel, Supabase-hosted migrations/pooler/TLS, the `calendar.freebusy` scope assumption, Google accepting UUID-hex event IDs.

## Exact next action
1. Human: configure env vars (`.env.example`; never in chat), apply migrations `0001`, `0002`, `0003` on Supabase, create the Google OAuth client.
2. Human: run UAT steps 1–19 in `docs/M2_SETUP_AND_UAT.md`; record observations in `duck/VERIFICATION_LEDGER.md`.
3. Agent (next session): fix anything UAT surfaces (expected candidates: scope override, Google event-ID acceptance, TLS/pooler settings). Then mark M2 VERIFIED only for observed items.
4. After the first real booking is observed, record M2.1 evidence and mark only the observed rows VERIFIED.

## Local dev without Google
`npm run verify`; `TEST_DATABASE_URL=postgres://… npm run test:db` (wipes that DB's `public` schema). The app pages render a "Not configured yet" message until env vars are set.

## Human decisions only if needed
Final product name; launch provider list; whether direct bypass remains permanent beyond V0; monetization.

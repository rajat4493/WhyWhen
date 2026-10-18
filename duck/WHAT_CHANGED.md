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

### Change Proposal decisions (human, 2026-10-17)
- **CP-M2-1 — APPROVED → HUMAN.** Google Calendar OAuth is also host authentication for V0. No separate authentication system will be built. Recorded as HUMAN-approved product scope.
- **CP-M2-2 — REJECTED AS WRITTEN → replaced by HUMAN decision.** The slug is NOT derived permanently from the email local-part. Instead, at first-time setup the dashboard suggests a slug from the Google display name in an editable field ("WhyWhen link  whywhen.ai/[rajat]"); the host chooses the final slug; it is validated (allowed characters, reserved words, uniqueness) and persisted. V0 explicitly excludes later slug editing, slug history and redirects.
  - IMPLEMENTATION-NECESSARY: migration `0003_host_chosen_slug.sql` makes `hosts.slug` nullable. A new host has no public page until the slug is chosen. Uniqueness stays a DB unique index, so concurrent claims are safe.

## M2.1 — Real Google booking verification (HUMAN)
- Next milestone is verification only. No new product features before it passes: no Outlook/Microsoft, Zoho, Gmail, MCP expansion, payments, teams, analytics or AI enhancements.

## Strategy (proposed, not approved)
- **CP-STRAT-1 — awaiting human approval.** `docs/PRODUCT_STRATEGY.md`: compete on segment-specific axes (intent-first, honest reliability, page speed, calm looks, free core for solos) instead of feature parity with Calendly/Cal.com. Published scoreboard with evidence states. Proposed new milestone **M2.2** (after M2.1): conflict check across all host calendars, auto Google Meet link, public page < 100 KB. No scope or code change until approved; M2.1 remains the gate.

## Visual redesign (HUMAN request, 2026-10-18)
- HUMAN: "it looks ugly; design it as if it were your product." Visual and UX-pattern redesign only. **No new product capability** (M2.1 gate respected): same flows, endpoints and data.
- Public page: host monogram + name, serif headline with italic accent, single composer card, "Book a time directly" as a quieter secondary row.
- Booking: month calendar grid with open days tinted + time list (side-by-side on desktop), timezone line, summary card, success mark. Manage page uses the same shell.
- Dashboard: sections (Your link with Copy, Upcoming, Meeting/Weekly hours/Rules, Google Calendar), segmented meeting length, 24 h half-hour time selects.
- Landing page: "Ask *why* before *when*." with a product preview.
- Dark mode via `prefers-color-scheme`. Self-hosted Instrument Serif (`@fontsource/instrument-serif@5.3.0`, pinned).
- IMPLEMENTATION-NECESSARY: availability request cap 31 → 45 days (one month view plus timezone margin per request).
- EVIDENCE-DISCOVERED: native `<input type=time>` cut AM/PM on narrow phones (17:00 displayed as "05:00") → replaced with 24 h selects.

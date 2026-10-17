# Handoff

## Current milestone
M1 — Runnable local shell: VERIFIED. Next: M2 (blocked on credentials, see below).

## Product truth
Read `docs/PRODUCT_INTENT_LOCKED_V1.md`.

## What exists
- Next.js starter UI
- direct booking surface
- mock intent API
- slot calculator + tests
- calendar adapter contract
- partial Google/Microsoft/Zoho REST adapters
- Supabase schema with overlap-preventing holds
- AI runtime abstraction with mock + OpenAI-compatible adapter
- detailed milestones

## Verified in bootstrap environment
- dependency-free core/calendar TypeScript subset compiled with global TypeScript 5.8.3
- three direct slot-engine assertions passed

## Explicitly not verified yet
- npm install/full Next.js build/full typecheck/Vitest (sandbox cannot resolve npm registry DNS)
- OAuth
- any live calendar API call or real booking
- AI Gateway adapter
- Zoho normalization/cancellation
- MCP implementation

## M2 prerequisites needed from human
Google OAuth client ID/secret + redirect URI, a Supabase project (URL + service key) to apply `supabase/migrations/0001_initial.sql`, and a test Google calendar. Set as env secrets, not in chat.

## Exact next action (original)
On a networked machine run `npm install`, then `npm run verify`. Fix scaffold/runtime issues only. Record evidence in `duck/VERIFICATION_LEDGER.md`. Then start M2 with Google OAuth + complete booking transaction.

## Human decisions only if needed
Final product name; launch provider list; whether direct bypass remains permanent beyond V0; monetization.

# Intent Scheduler — Claude Code Starter

Working title only. This repository is a **TheDuck-governed Claude Code project** for an AI-native scheduling product.

## Product in one sentence
One public link where a visitor can either **book time directly** or explain what they need; AI can qualify, answer, route, or recommend a meeting, while booking continues to work even if AI is unavailable.

## V0 promise
- Host connects a calendar and publishes a link.
- Visitor can always click **Book a time** and see real availability.
- Visitor can alternatively type an intent.
- AI may classify, ask at most two clarifying questions, suggest duration, or recommend no meeting.
- Visitor can override AI and book.
- Booking creates a real calendar event and a local booking record.
- Calendar adapters: Google, Microsoft/Outlook, Zoho.
- AI is swappable: AI Gateway default, OpenAI-compatible direct API, deterministic mock.
- MCP is an interoperability surface, not the source of truth.

## Stack
Next.js + TypeScript, Supabase Postgres (via server-side `pg`), Vercel, Vercel AI SDK/Gateway, REST calendar adapters, MCP adapter layer, Vitest.

## Start
```bash
npm ci
cp .env.example .env.local   # fill in locally; see docs/M2_SETUP_AND_UAT.md
npm run dev
```

## Checks
```bash
npm run verify                                  # typecheck + unit tests + production build
TEST_DATABASE_URL=postgres://… npm run test:db  # real-Postgres race/constraint tests (wipes that DB's public schema)
```

Read `CLAUDE.md`, `docs/PRODUCT_INTENT_LOCKED_V1.md`, and `duck/MILESTONES.md` before implementation.

## Verification status
M1 VERIFIED. M2 (Google Calendar booking) IMPLEMENTED NOT VERIFIED against live Google/Supabase. Awaiting the manual UAT in `docs/M2_SETUP_AND_UAT.md`. Not production ready. See `duck/VERIFICATION_LEDGER.md`.

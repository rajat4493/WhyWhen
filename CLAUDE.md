# Claude Code Instructions — Intent Scheduler

You are the coding agent for this repository. The product is governed by TheDuck.

## Required reading order
1. `docs/PRODUCT_INTENT_LOCKED_V1.md`
2. `docs/JTBD.md`
3. `docs/SCOPE.md`
4. `duck/MILESTONES.md`
5. `docs/SYSTEM_DESIGN.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/ACCEPTANCE_CRITERIA.md`
8. `duck/HANDOFF.md`

## TheDuck rule
**Challenge before lock. Protect after lock.**

Do not silently broaden or reinterpret product intent. Material product changes go into `duck/WHAT_CHANGED.md` as a Change Proposal and require human approval.

Classify material changes as: `HUMAN`, `THEDUCK-SUGGESTED + HUMAN-APPROVED`, `IMPLEMENTATION-NECESSARY`, or `EVIDENCE-DISCOVERED`.

Evidence labels only: `VERIFIED`, `IMPLEMENTED NOT VERIFIED`, `ASSUMPTION`, `OPEN QUESTION`, `FAILED`.
Never say works/tested/passes/validated/production ready without observed evidence.

## Product invariants
1. Direct booking is a V0 feature.
2. AI is never required for direct booking.
3. Public page: dominant intent input, immediately visible secondary `Book a time`.
4. One canonical booking model; provider adapters translate vendor formats.
5. Prefer live free/busy over a sync engine in V0.
6. Re-check availability immediately before event creation.
7. Prevent internal double booking with DB holds/exclusion.
8. Secrets never reach the client.
9. Visitor UI stays calm, minimal, mobile-first.
10. Do not add CRM, payments, teams, round-robin, analytics suites, or enterprise admin without a scope change.

## AI rules
- Prefer Vercel AI Gateway as default.
- Model IDs come from configuration, never hard-coded stale examples.
- Support `mock`, `gateway`, and `openai-compatible` runtime modes.
- Schema-validate AI output.
- AI recommends; it cannot create a booking without visitor confirmation.
- At most two clarification questions in V0.
- Before coding against Vercel AI SDK, inspect the installed version and bundled `node_modules/ai/docs`.

## Integration rules
Core speaks to capability interfaces.
Calendar: free/busy, create, reschedule, cancel.
Mail: optional search/read/send with explicit permission.
MCP: expose scheduling tools and optionally consume approved remote tools; MCP is not booking truth.

## Coding rules
TypeScript strict; pure domain functions; server-only provider code; validate untrusted boundaries; UTC internally; IANA timezone at policy/display boundaries; idempotency on writes; never confirm before provider event creation succeeds.

## UI rules
Follow `docs/DESIGN_SYSTEM.md`. No gradients, glassmorphism, neon, AI sparkle clutter, or oversized dashboards.

## Milestone workflow
For every milestone: implement smallest proof → run focused tests/typecheck/build/live test if authorized → update verification ledger → update handoff → capture TheDuck learning → stop for material human decisions.

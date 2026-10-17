# Verification Ledger

| Item | State | Evidence |
|---|---|---|
| Product intent documented | VERIFIED | Scaffold files created |
| TheDuck agent contract included | VERIFIED | `CLAUDE.md`, `AGENTS.md`, `/duck` |
| Minimal public UI code | VERIFIED (build only) | `npm run build` succeeded; 7 routes generated. UI not viewed in a browser |
| Scheduling core TypeScript compile | VERIFIED | `scripts/verify-core.sh` compiled domain, slot engine and calendar adapters with global `tsc 5.8.3` |
| Slot core assertions | VERIFIED | 3 observed Node assertions passed: empty calendar, busy overlap, buffers |
| Full typecheck / Vitest / Next build | VERIFIED | M1 session: `npm install` OK, `npm run verify` exit 0, 7/7 Vitest tests pass |
| Mock AI tests | VERIFIED | 2/2 pass after fixes below |
| Google adapter code | IMPLEMENTED NOT VERIFIED | No live test |
| Microsoft adapter code | IMPLEMENTED NOT VERIFIED | No live test |
| Zoho adapter code | IMPLEMENTED NOT VERIFIED | Normalization deliberately gated |
| Supabase schema | IMPLEMENTED NOT VERIFIED | Migration not applied |
| Real booking | OPEN QUESTION | M2 |
| AI Gateway mode | OPEN QUESTION | M3 |
| MCP | OPEN QUESTION | M5 |
| Production readiness | FAILED | Hardening incomplete |

## Bootstrap environment evidence

- `curl https://registry.npmjs.org/next` failed with DNS resolution error in the execution sandbox.
- Therefore `npm install`, full `npm run typecheck`, Vitest and Next production build remain unverified here.
- This is an execution-environment limitation, not evidence that the application build succeeds.

## M1 verification (networked machine)

- `npm install` (next, react, ai, zod, supabase-js, vitest@5.0.5, typescript@7.0.2 via `latest`): 81 packages, 0 vulnerabilities.
- Initial `npm run verify` FAILED: TS2554 in `registry.ts` and `ai-mock.test.ts` (`MockIntentAdapter.decide` did not accept the config arg the interface requires). FIXED: optional `_config` param.
- Second run: 1 Vitest FAILURE: "What is your consulting rate?" classified as needing a meeting (regex `consult` matched "consulting"). FIXED: word-boundary regex.
- Final `npm run verify`: typecheck, 7/7 tests, production build all pass.
- `scripts/verify-core.sh` FAILS under TypeScript 7.0.2 (TS5112: tsconfig present + files on CLI). Superseded by `npm run verify`; script not fixed. `typescript` is unpinned (`latest`) across all deps; pinning is recommended.
- Not verified: OAuth, live calendar calls, real bookings, AI Gateway, Zoho, MCP, Supabase migration.

# Verification Ledger

| Item | State | Evidence |
|---|---|---|
| Product intent documented | VERIFIED | Scaffold files created |
| TheDuck agent contract included | VERIFIED | `CLAUDE.md`, `AGENTS.md`, `/duck` |
| Minimal public UI code | VERIFIED (build only) | `npm run build` succeeded; 7 routes generated. UI not viewed in a browser |
| Scheduling core TypeScript compile | VERIFIED | Covered by `npm run typecheck` (full project, pinned TypeScript 7.0.2). Bootstrap-only `scripts/verify-core.sh` removed |
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
- `scripts/verify-core.sh` FAILED under TypeScript 7.0.2 (TS5112: tsconfig present + files on CLI). It duplicated `npm run verify` (same 3 slot assertions exist in `tests/availability.test.ts`), so it was REMOVED.
- Not verified: OAuth, live calendar calls, real bookings, AI Gateway, Zoho, MCP, Supabase migration.

## M1 reproducibility closure

- All dependencies pinned to the exact installed versions (no `latest`/`^`): next 16.4.2, react/react-dom 19.3.1, ai 7.0.143, zod 4.6.7, @supabase/supabase-js 2.118.0, typescript 7.0.2, vitest 5.0.5, @types/node 26.6.5, @types/react 19.3.0, @types/react-dom 19.3.0. `.npmrc` sets `save-exact=true`. `package-lock.json` committed.
- CI and Dockerfile switched from `npm install` to `npm ci` (lockfile-exact).
- VERIFIED (observed): `rm -rf node_modules .next && npm ci && npm run verify` → exit 0; typecheck clean; Vitest 2 files / 7 tests passed; `next build` compiled and generated all routes.
- `tsconfig.tsbuildinfo` (build cache) removed from git and ignored.

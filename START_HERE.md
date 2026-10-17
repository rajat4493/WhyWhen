# Start Here in Claude Code

Open this repository in Claude Code and give it this instruction:

> Read `CLAUDE.md` and the required TheDuck artifacts in order. Continue from the exact current milestone in `duck/HANDOFF.md`. First verify M1 on this machine (`npm install`, `npm run verify`) and update the verification ledger with observed evidence. Do not broaden scope. After M1 is verified, implement M2: real Google Calendar OAuth + live availability + DB hold + re-check + event creation + idempotency + cancel/reschedule, then stop at the M2 evidence gate.

Do not paste API secrets into Claude chat. Configure them through local/environment secret files only.

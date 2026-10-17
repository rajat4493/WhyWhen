# Milestones

## M0 — Intent & architecture lock
**Status:** VERIFIED for documentation only  
Outcome: locked V0 behavior, system design, design language, scope, test plan.

## M1 — Runnable local shell
**Status:** IMPLEMENTED NOT VERIFIED  
Outcome: minimalist public page, direct booking page, dashboard shell, mock intent endpoint, pure slot engine.  
Exit: install succeeds; typecheck/tests/build observed passing.

## M2 — Google Calendar real booking
**Status:** NOT STARTED  
Outcome: OAuth + live free/busy + hold + re-check + event creation + cancellation/reschedule + idempotency.  
Exit: real Google test account E2E observed.

## M3 — AI routing + model switching
**Status:** PARTIAL  
Outcome: mock + AI Gateway + OpenAI-compatible modes, host model config, schema validation, graceful degradation.  
Exit: at least two configured models exercised on same fixtures; booking succeeds with AI disabled.

## M4 — Microsoft + Zoho calendars
**Status:** PARTIAL ADAPTER SCAFFOLD  
Outcome: same calendar contract, live fixtures, E2E create/cancel for each.  
Exit: provider-specific E2E evidence.

## M5 — MCP + mail capabilities
**Status:** NOT STARTED  
Outcome: trusted MCP scheduling tools; optional Gmail/Outlook/Zoho Mail adapters only for a concrete flow.  
Exit: capability authorization tests + tool evidence.

## M6 — Private pilot hardening
**Status:** NOT STARTED  
Outcome: security, abuse limits, deployment, mobile/accessibility UAT, operational logging.  
Exit: `VAT_UAT.md` private-pilot gate complete.

# Test Strategy
Unit: slot generation, overlaps/buffers, timezone helpers, AI schema, idempotency, signed tokens, provider fixture normalization.

Integration per provider: free/busy mapping, create, cancel, 401 expiry, 429, malformed responses.

Concurrency: same slot, partial overlap, idempotent retry, provider availability changes between display and confirm.

E2E: onboarding → direct booking → observe provider event → cancel/reschedule → break AI → direct booking still succeeds → mobile.

Security: OAuth state/PKCE, cross-account access, log secret checks, SSRF, prompt injection.

Release rule: provider cannot be marketed as supported until real booking E2E is `VERIFIED`.

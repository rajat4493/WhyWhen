# Security & Privacy
Sensitive assets: OAuth tokens, model API keys, email/calendar metadata, visitor emails, booking management tokens.

V0 controls: server-only credentials; encrypted blobs; least privilege; signed expiring management links; idempotency; rate limits before open launch; no busy-event metadata leakage; audit create/cancel/reschedule/connect/disconnect; retention decision before launch.

Threat tests: forged management link, replay, concurrent slot requests, malicious AI tool request, prompt injection in mail context, provider error leakage, SSRF via custom AI/MCP endpoint, OAuth state/PKCE bypass, cross-host enumeration.

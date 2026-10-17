# Security & Privacy
Sensitive assets: OAuth tokens, model API keys, email/calendar metadata, visitor emails, booking management tokens.

V0 controls: server-only credentials; encrypted blobs; least privilege; signed expiring management links; idempotency; rate limits before open launch; no busy-event metadata leakage; audit create/cancel/reschedule/connect/disconnect; retention decision before launch.

Threat tests: forged management link, replay, concurrent slot requests, malicious AI tool request, prompt injection in mail context, provider error leakage, SSRF via custom AI/MCP endpoint, OAuth state/PKCE bypass, cross-host enumeration.

## M2 implemented controls (IMPLEMENTED NOT VERIFIED in production; unit/local evidence in the ledger)
- Google tokens: AES-256-GCM at rest (`APP_ENCRYPTION_KEY`), AAD = host id (ciphertext can't be moved between hosts); decrypted only server-side; never sent to the browser; wiped on disconnect/revocation.
- OAuth: authorization code + PKCE (S256) + random `state` in a signed, HTTP-only, 10-minute, path-scoped cookie; granted scopes checked; `prompt=consent` + offline access; least-privilege calendar scopes.
- Sessions: signed (HMAC-SHA256) HTTP-only `SameSite=Lax` cookie (`Secure` in production), 7 days; purpose-scoped signatures (a session value can't be replayed as OAuth state or a manage link). Stateless: sign-out clears the cookie; server-side revocation requires rotating `SESSION_SECRET` (OPEN QUESTION for M6).
- Host mutations: session-derived host id only; Origin check on host POST routes; Next server actions for settings.
- Cross-host isolation: every host query is keyed by the session host id; booking cancel/reconcile verify ownership; calendar choice limited to calendars Google reports the host owns.
- Visitor management links: HMAC capability `/manage/<bookingId>.<mac>`; forged → 404; `noindex`.
- Public endpoints: zod validation (ids, ISO datetimes, IANA zones, name/email/notes limits, control-char/HTML rejection), 16 KB body cap, per-IP fixed-window rate limits (per instance — must move to a shared store before open launch).
- Supabase REST exposure: RLS enabled on all tables with no policies; app connects via server-only `DATABASE_URL`. No Supabase keys in the app.
- Logs: structured JSON; keys matching token/secret/code/key/authorization/cookie are redacted; provider errors logged as status + reason only.
- Busy-event details never leave the server (only free slot start/end).

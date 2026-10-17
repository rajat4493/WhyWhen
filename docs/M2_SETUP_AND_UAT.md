# M2 Setup and Manual UAT — Google Calendar real booking

This is the evidence gate for M2. Nothing here has been run against real Google or Supabase yet.
Record what you observe in `duck/VERIFICATION_LEDGER.md` (VERIFIED only for what you actually saw).

Configure every secret in `.env.local` (local) or your host's environment settings. Do not paste values into chat, issues or commits.

## 1. Environment variables

| Variable | Required | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Your app's base URL, no trailing slash. Local: `http://localhost:3000`. |
| `DATABASE_URL` | yes | Supabase → Project Settings → Database → Connection string (URI). On Vercel use the **Transaction pooler** (port 6543). |
| `DATABASE_CA_CERT` | recommended | Supabase → Database settings → SSL configuration → download certificate; paste the PEM. Enables full TLS verification. |
| `APP_ENCRYPTION_KEY` | yes | `openssl rand -base64 32`. Encrypts Google tokens at rest. Changing it forces hosts to reconnect. |
| `SESSION_SECRET` | yes | `openssl rand -base64 48`. Signs sessions, OAuth state and visitor manage links. |
| `GOOGLE_CLIENT_ID` | yes | Google Cloud Console → Credentials → OAuth client (Web application). |
| `GOOGLE_CLIENT_SECRET` | yes | Same OAuth client. |
| `GOOGLE_REDIRECT_URI` | yes | `${NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`, registered *exactly* on the OAuth client. |
| `GOOGLE_OAUTH_SCOPES` | no | Leave empty for the least-privilege default (see `.env.example`). |
| `BOOKING_HOLD_TTL_SECONDS` | no | Default 600. |
| `DATABASE_POOL_MAX` | no | Default 5. |
| `AI_MODE` | no | Leave `mock`. AI is not needed for M2. |

Supabase's anon/service-role keys are **not used**. The app talks to Postgres directly from the server only.

## 2. One-time setup

**Supabase**
1. Create a project. Copy the Transaction pooler connection string into `DATABASE_URL`.
2. SQL editor → run `supabase/migrations/0001_initial.sql`, then `supabase/migrations/0002_m2_google_booking.sql`. Or use `psql "$DATABASE_URL" -f …` for each file, in order.
3. Check: Table editor shows `hosts`, `integration_accounts`, `bookings` with RLS enabled (no policies is correct).

**Google Cloud**
1. Create or choose a project → APIs & Services → Library → enable **Google Calendar API**.
2. OAuth consent screen: User type External (or Internal if you use Workspace). Add your test Google account under **Test users**. Add the scopes listed in `.env.example`.
3. Credentials → Create credentials → OAuth client ID → **Web application** → Authorized redirect URI = `GOOGLE_REDIRECT_URI`.
4. Put the client ID and secret in your env.

**App**
```bash
npm ci
cp .env.example .env.local   # fill in values locally
npm run dev                  # http://localhost:3000
```
Use `npm run dev` for local HTTP. Production mode sets `Secure` cookies, which some browsers (Safari) refuse on plain `http://localhost`.

## 3. Manual UAT script (≈20 minutes)

Use a **test** Google account as host. Use a second email address you can read as the visitor. Note the time of each step.

| # | Do | Expect | Record |
|---|---|---|---|
| 1 | Open `/dashboard` → **Connect Google Calendar**. | Google consent screen lists calendar list (read), availability, and events on calendars you own. | Screenshot of scopes |
| 2 | Approve all boxes. | Back on dashboard: "Google Calendar connected", your email, public link `…/<slug>`, timezone = your primary calendar's timezone. | Slug |
| 3 | In Supabase run `select status, encrypted_credentials from integration_accounts;` | `active`, ciphertext starting `v1.`. No readable token. | ✓/✗ |
| 4 | Dashboard: choose calendar, timezone, weekly hours, 30 min, buffers 0/0, minimum notice 1 hour, horizon 14 days → **Save**. | "Saved." | |
| 5 | In Google Calendar create a busy event tomorrow 10:00–11:00 (your timezone). | — | |
| 6 | In a private window on your phone open `/<slug>` → **Book a time directly**. | Dates with free times; tomorrow shows no 10:00 or 10:30 slots; times shown in the phone's timezone. | Screenshot |
| 7 | Pick tomorrow 11:00 → enter visitor name/email → check the summary line → **Confirm booking**. | "You're booked", exact date/time/timezone, "invitation sent to …". | Time to confirm |
| 8 | Check the host Google Calendar. | One event "<Visitor> and <Host>" at 11:00, visitor as attendee, description contains a "Reschedule or cancel" link. | Event screenshot |
| 9 | Check the visitor inbox. | Google invitation for 11:00. | ✓/✗ |
| 10 | Reload the booking page. | 11:00 no longer offered. | ✓/✗ |
| 11 | **Race:** open the same slot (e.g. 13:00) in two browsers, select it in both. | The second gets "That time is no longer available." | ✓/✗ |
| 12 | **Re-check:** select 14:00 (hold), then add a Google event 14:00–14:30 in Google Calendar, then confirm. | "That time is no longer available." No event created. | ✓/✗ |
| 13 | Open the manage link from the success screen or invitation → **Reschedule** → pick 15:00 → **Confirm new time**. | "Moved." Google event now 15:00; visitor gets an update; 11:00 is bookable again on the public page. | ✓/✗ |
| 14 | Manage link → **Cancel booking** → **Yes, cancel**. | "This booking is cancelled." Google event removed; visitor gets a cancellation; 15:00 bookable again. | ✓/✗ |
| 15 | Book again, then cancel it from the dashboard **Cancel** button. | Status Cancelled; event removed. | ✓/✗ |
| 16 | **AI broken:** set `AI_MODE=openai-compatible` with no key, restart, and repeat steps 6–8. | Booking still succeeds. | ✓/✗ |
| 17 | **Token refresh:** wait > 1 hour (access token expiry), then load the booking page. | Slots load (refresh worked). `integration_accounts.updated_at` changed. | ✓/✗ |
| 18 | **Revocation:** at myaccount.google.com/permissions remove the app, wait up to 1 hour or until the token expires, then load the booking page. | "isn't accepting bookings right now" or "Availability can't be checked"; dashboard shows Not connected → Reconnect works. | ✓/✗ |
| 19 | Dashboard → **Disconnect Google**. | Public page paused; the app disappears from your Google permissions page. | ✓/✗ |

If step 6 fails with an availability error right after connecting, check the server log for `free/busy failed: 403`. If you see `insufficientPermissions`, set `GOOGLE_OAUTH_SCOPES` as described in `.env.example`, reconnect, and record it as EVIDENCE-DISCOVERED.

## 4. Optional local checks (no Google needed)
```bash
npm run verify                                   # typecheck + unit tests + build
TEST_DATABASE_URL=postgres://… npm run test:db   # real-Postgres race/constraint tests (wipes the target DB's public schema)
```

# Human Summary

Plain English. What changed, what works, what you need to do. Updated 2026-10-17 (M2 approved; next: M2.1 real Google booking verification).

## In one paragraph
The app can now, in code, do the full Google Calendar booking loop. You sign in with Google, pick your calendar and hours, and share a link. A visitor picks a date and time, enters a name and email, and confirms. A real event lands in your Google Calendar with the visitor invited, and the visitor can reschedule or cancel from a link. It has **not been run against your real Google account or Supabase yet**. That's the next step, and only you can do it, because it needs your credentials.

## What changed
- **Setup was made reproducible (M1).** Every library is pinned to an exact version, so a fresh install builds the same way every time. A broken leftover check script was removed.
- **Google connection.** "Connect Google Calendar" on `/dashboard` signs you in and connects your calendar in one step. Your Google tokens are stored encrypted and never reach a browser. Disconnecting revokes the app's access at Google.
- **Your settings.** Calendar, timezone, weekly hours, meeting length (15/30/45/60), buffers before and after, minimum notice, and how far ahead people can book. Nothing more.
- **Visitor booking.** Date → time → name/email → confirm → "You're booked". Times appear in the visitor's own timezone. The exact date, time and timezone are repeated before and after confirming.
- **No double bookings.** When someone picks a time, it is held for 10 minutes. Just before confirming, we check your Google Calendar again. The database refuses two bookings for the same time even if two people click at the same instant (tested with 20 at once).
- **Honest when Google misbehaves.** If Google rejects the booking, the visitor is told nothing was booked. If Google doesn't answer, the time stays reserved and the visitor is told they are *not booked yet* and can retry safely. You also see it on your dashboard with a Retry button. We never say "booked" unless Google confirmed it.
- **Reschedule and cancel.** Visitors use the link in their invitation or confirmation. You can cancel from the dashboard. Google sends everyone the updates.
- **AI stays optional.** Booking never touches the AI. It was tested with the AI deliberately broken.

## Decisions I made that you should know about
- The app talks to the Supabase database directly from the server (a standard Postgres connection) instead of through Supabase's web API. It is more reliable for preventing double bookings, and you don't need any Supabase API keys.
- Your decisions are in:
  1. **Approved:** connecting Google Calendar is also how hosts sign in. No separate login system.
  2. **Changed as you asked:** after connecting Google, the first screen is "Choose your link". It shows **WhyWhen link  whywhen.ai/[rajat]** pre-filled from your Google name. You can edit it, and it is checked for allowed characters, reserved words (like `dashboard`) and whether someone else already has it. It is saved once. Changing it later isn't part of V0.

## New look (2026-10-18)
The whole app was redesigned: your name and initials lead every public page, headlines use an elegant serif, booking uses a real month calendar, the dashboard is grouped into clear sections, and there's a dark mode. Same features underneath; nothing new was added before the first real booking test.

## Fixed: "What do you need?"
Pressing Continue used to show visitors a page of raw code. Now it takes them straight to booking with their request shown at the top and filled into the booking, so it appears in your Google Calendar event. Real AI answers come in M3; your "What I help with" note (approved) will power them.

## Known limits (for now)
- Moving a meeting to a time that overlaps its current time isn't supported. Pick a non-overlapping time.
- Abuse limits are per server instance and need upgrading before a public launch.
- If Google never answers and nobody retries, the booking waits on your dashboard for you to press Retry. There is no automatic background fixer yet.

## What's next: M2.1
Only one thing: prove a real booking. A visitor opens your public link, sees free times from your real Google Calendar, books one, and a real Google event and invitation appear. No new features until that works.

## What you need to do
1. Fill in the settings listed in `docs/M2_SETUP_AND_UAT.md` section 1 (on your machine or Vercel, never in chat).
2. Run the three database scripts on Supabase (`0001`, `0002`, `0003`).
3. Follow `docs/M2_SETUP_AND_UAT.md` with a test Google account and tell the next session what you saw.

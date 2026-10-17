# User Flows
## Host onboarding
Connect Google Calendar (= sign in, CP-M2-1) → choose WhyWhen link (suggested from Google display name, editable once) → calendar/timezone/working hours/buffers/duration/notice/horizon → share link.

## Visitor intent-first
Open `/{slug}` → type request → AI classifies → zero-to-two clarifying questions → answer/route or recommend duration + slots. `Book a time` remains visible.

## Visitor direct booking
Open `/{slug}` → Book a time → duration → live free/busy → slot → visitor details → DB hold → live re-check → provider event creation → local persistence → confirmation.

## AI degraded
AI errors/timeouts → calm degraded message → direct booking still available.

## Cancel/reschedule
Signed management link → validate → provider action → local update → confirmation.

# User Flows
## Host onboarding
Sign in → slug → connect calendar → timezone/working hours/buffer/default duration → optional AI → preview → publish.

## Visitor intent-first
Open `/{slug}` → type request → AI classifies → zero-to-two clarifying questions → answer/route or recommend duration + slots. `Book a time` remains visible.

## Visitor direct booking
Open `/{slug}` → Book a time → duration → live free/busy → slot → visitor details → DB hold → live re-check → provider event creation → local persistence → confirmation.

## AI degraded
AI errors/timeouts → calm degraded message → direct booking still available.

## Cancel/reschedule
Signed management link → validate → provider action → local update → confirmation.

# Product Intent — Locked V1
**Status:** HUMAN-LOCKED for V0 bootstrap

## Problem
Scheduling links solve “when”, but not “why”, “does this need a meeting?”, or “what context should exist before the meeting?”.

## Thesis
Give a person one public access link. A visitor can state the outcome they want or book directly. AI helps route intent, but direct booking is always available and independent of AI.

## V0 promise
For a single host: connect one supported calendar; define availability; publish one link; allow intent or direct booking; show real free slots; create a real provider event after confirmation; support secure cancel/reschedule; optionally classify intent with AI; allow AI model/runtime switching; keep calendar, mail and MCP behind capability adapters.

## Non-negotiables
- Booking must function when AI is unavailable.
- AI cannot silently book.
- Visitor sees exact date/time/timezone before confirmation.
- Availability is re-checked immediately before booking creation.
- Host secrets never reach browser.
- Vendor-specific objects never become the canonical domain model.

## V0 target user
Solo professional with meaningful inbound requests: consultant, founder, architect, recruiter, advisor, creator, sales engineer, service professional.

## Success signal
At least one real host can share a link, a visitor can book a real available slot end-to-end, and AI routing can be enabled without reducing booking reliability.

## Not V0
Not LinkedIn+chatbot, CRM, team scheduler, sales engagement suite, full email client, autonomous executive assistant, or enterprise workflow platform.

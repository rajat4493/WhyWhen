# Acceptance Criteria
## Booking
- [ ] Host connects a real calendar provider.
- [ ] Busy event details never reach visitor; only free slots.
- [ ] Visitor can create a real event in displayed free slot.
- [ ] Correct visitor email/start/end/timezone.
- [ ] Concurrent same-slot booking is rejected/refreshed.
- [ ] Provider free/busy rechecked after local hold.
- [ ] Same idempotency key never creates duplicate event.
- [ ] Direct booking succeeds with AI broken.

## AI
- [ ] Host can select runtime/model from allowed config.
- [ ] Output is schema validated.
- [ ] At most two clarification questions.
- [ ] AI never silently creates booking.
- [ ] Invalid output degrades safely.

## UX
- [ ] Dominant intent input + immediately visible `Book a time`.
- [ ] No horizontal mobile scroll.
- [ ] Visible keyboard focus.
- [ ] Timezone before confirmation.
- [ ] No existing event details leak.

## Operations
- [ ] Fresh deploy from documented env vars.
- [ ] Typecheck/tests/build pass.
- [ ] Ledger records exact observed provider evidence.

# Product Strategy: How WhyWhen wins its segment

Status: **PROPOSAL (CP-STRAT-1), awaiting human approval.** Nothing here changes scope until approved. M2.1 (first real Google booking) stays the gate before any new feature.

## 1. The owner's call on the objective
"Outperform every competitor on features, cost, performance and looks" is the wrong target as written.
- **Features:** Calendly and Cal.com have years of breadth: routing, teams, workflows, payments and hundreds of integrations. Chasing feature parity is a race we lose, and it would turn a calm product into another settings maze. That breaks product invariants 9 and 10.
- **The right target:** be measurably best for **our segment** on the axes that segment feels every day, and reach parity only on the table stakes that make people leave.

Segment (locked): a solo professional with meaningful inbound requests, such as a consultant, founder, advisor, recruiter or creator.

## 2. Competitive landscape
Prices are an ASSUMPTION. They come from third-party 2026 guides, which disagree; check vendor pages before using any number.

| Product | Solo price (approx.) | Strength | Weakness for our segment |
|---|---|---|---|
| Calendly | Free (1 event type, branding); ~$10–12/seat/mo Standard | Brand, breadth, integrations | Heavy settings; treats every request as a meeting; paid for basics |
| Cal.com | Free individual; paid teams | Open source, flexible | Complex configuration; developer-feel UI |
| SavvyCal | ~$10–12 Basic | Visitor-friendly overlay UX | Paid for the core link; no "does this need a meeting?" |
| Google Calendar appointment schedules | Included with Google | Zero setup for Google users | Bare UI, no intent layer, Google-only |
| Microsoft Bookings | Included with M365 | Free for Microsoft shops | Clunky, enterprise-feel |

Nobody owns **"tell me what you need first"**. Every competitor assumes the answer is a meeting.

## 3. Where we win
1. **Intent first, not slot first.** A visitor states the outcome. We answer, route or recommend no meeting, and still offer *Book a time directly* one tap away. This is the wedge (M3).
2. **Honest reliability.** We never show "booked" unless the calendar confirmed it, and a database constraint plus live re-check means no double bookings. Most tools don't publish how they handle provider timeouts; we can, and we can prove it.
3. **Fastest public page in the category.** It is server-rendered, uses minimal JS, and never syncs your calendar. Live free/busy keeps infrastructure tiny.
4. **Calm looks.** One question, one dominant action, no marketing clutter on a real person's page.
5. **Cost.** No sync engine, no queue and no per-host workers means near-zero marginal cost per host. That lets the **core direct booking be free for solos, permanently**. Pricing is the human's decision (§6).

## 4. Table stakes we must reach (gap analysis vs. today's code)
These are the reasons a Google-using solo would leave after a week. They are ordered by cost and impact.

| Gap | Why it matters | Size |
|---|---|---|
| **Conflicts across all of the host's calendars** (today: only the selected calendar is checked) | People with work + personal calendars get double-booked; it's the #1 trust killer | S: free/busy accepts multiple calendar ids |
| **Video link on the invite** (Google Meet `conferenceData`) | Almost every remote meeting needs it; today's invite has no link | S |
| **Outlook / Microsoft 365** (M4) | A large share of professionals; Google-only caps the market | M |
| Custom visitor question(s) | Hosts need context before the call (the intent box covers part of this) | S |
| Embed / inline widget | Hosts put links on their own sites | M (post-launch) |

Deliberately **not** pursued (segment mismatch): teams, round-robin, CRM, payments, workflow builder, analytics suite.

## 5. The scoreboard (benchmarks we publish and hold ourselves to)

| Axis | Metric | Target | Current baseline | Evidence state |
|---|---|---|---|---|
| Visitor speed | Taps from public page to "You're booked" | ≤ 5 | 5 (Book → time → name/email → confirm; first date preselected) | VERIFIED (local, Playwright) |
| Page weight | Transferred bytes, `/{slug}/book` first load | < 100 KB | 186 KB (`/{slug}`: 195 KB) after the 2026-10-18 redesign (+~45 KB serif fonts); was 148 KB | VERIFIED (local build, 2026-10-18) |
| Page speed | LCP, emulated 1.6 Mbps/150 ms | < 1.0 s on real 4G | 404 ms (`/book`), 424 ms (`/{slug}`) on a local server | VERIFIED (local only; not real network) |
| Availability latency | p95 of availability API | < 500 ms | not measured | IMPLEMENTED NOT VERIFIED (needs live Google) |
| Correctness | Double bookings under concurrency | 0 | 0 in 20-way and 10-visitor races, 80+ runs | VERIFIED (local Postgres) |
| Honesty | Bookings shown "booked" without provider confirmation | 0 | 0 by design + tests | VERIFIED (local) |
| Host onboarding | Time from "Connect Google" to live link | < 90 s | not measured | OPEN QUESTION |
| Accessibility | WCAG 2.1 AA | pass | focus visible, no h-scroll at 360 px; no full audit | OPEN QUESTION |
| Cost | Infra cost per active host per month | < $0.05 | not measured | ASSUMPTION |

A benchmark is claimed publicly only when its row is VERIFIED against production.

## 6. Proposed sequence
1. **M2.1 Real Google booking verification** (now; unchanged).
2. **M2.2 Google table stakes (new, proposed):** check all of the host's calendars for conflicts, add an auto Google Meet link, and bring page weight under 100 KB. Small, and it removes the top reasons to churn.
3. **M3 Intent routing**: the wedge. Measure "requests resolved without a meeting" as the headline metric.
4. **M4 Outlook / Microsoft 365.**
5. **M6 Launch hardening**: shared rate limits, monitoring, accessibility audit, and a public benchmark page built from the scoreboard.

## 7. Decisions needed from the human
1. Approve this strategy, the scoreboard and the M2.2 insertion (CP-STRAT-1).
2. Pricing principle: *core direct booking free for solos forever; pay for AI intent routing, custom domain, multiple event types*. Numbers to be set later.
3. Final product name and domain (`whywhen.ai` assumed in copy examples).

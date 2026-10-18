# WhyWhen Design System
## Intent
Quiet, warm, personal. A visitor should feel they are writing to a person, not filling in a SaaS form. Restraint over "AI product" styling.

## Principles (why it looks like this)
1. **A person, not a product.** Every public page leads with the host: monogram avatar + name. Brand is a whisper in the footer.
2. **One question, one primary action per screen.** Secondary paths are quieter rows, never equal-weight buttons.
3. **Calendar mental model.** Month grid with open days tinted; times as tap targets next to (desktop) or below (phone) the grid. This is the pattern visitors already know from Calendly, Cal.com and SavvyCal; we don't make people learn a new one.
4. **Say the exact time, date and timezone** before and after confirming. The picker shows "Times shown in <zone>".
5. **Honest states.** "Not booked yet" is visually distinct (warning tone) from "You're booked" (success mark).

## Tokens (`src/app/globals.css`, light + dark via `prefers-color-scheme`)
- Paper `--bg #f6f4ef`, surface `#fffefb`, ink `#1b1a17`, muted `#77736a`, line `#e6e2d9`.
- One accent: deep green `--accent #1e6b5a` (dark mode `#5fbf9f`) with soft tints for available days/time chips.
- Type: **Instrument Serif** (self-hosted via `@fontsource`, latin subset only) for display headings, with italic accent words ("What do you *need*?"); the **system UI font** for everything else (zero download, native feel).
- Radius 10 / 14 / 20 px; pills fully rounded. Borders before shadows; one soft shadow on the main card.
- Motion 120–180 ms, functional only; respects `prefers-reduced-motion`.

## Components
`card`, `panel`, `button` (primary = ink, accent = green, ghost), `field`, `segmented` (radio group), `notice` (ok/warn/error), `pill` (`live` variant), `avatar`, `cal-day`, `slot`, `summary`, inline SVG icon set (`components/icons.tsx`, no icon library).

## Rules
No gradients, glow, glassmorphism, 3D, confetti or AI sparkles. Tap targets ≥ 44 px. WCAG AA contrast. No horizontal scroll at 360 px. Never reveal busy-event details.

## Copy
Short and human. Avoid "AI-powered", "revolutionary", "seamless". Don't claim anything the ledger hasn't verified, and nothing about pricing until it's decided.

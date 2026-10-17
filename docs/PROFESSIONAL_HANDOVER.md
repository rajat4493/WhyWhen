# Professional Engineering Handover
## Product
AI-native intent + scheduling link for solo professionals.

## Current state
Starter scaffold: locked V0 docs, minimalist UI shell, domain types, slot calculation, provider adapter contracts, partial Google/Microsoft/Zoho REST adapters, AI mock/direct interface, Supabase schema and tests.

## Critical architecture
Next.js modular monolith; Supabase/Postgres; live free/busy; interval holds + provider re-check; optional AI; capability-based integrations.

## Before private pilot
Auth/onboarding; credential encryption + OAuth; real Google booking transaction; cancel/reschedule; AI Gateway adapter against installed docs; live Microsoft; Zoho fixtures/normalization; rate limits; deploy + UAT.

Verification ledger is authoritative. Code presence is not readiness.

# Deployment
## Default: Vercel + Supabase
Create Supabase → run migrations `0001`, `0002`, `0003` in order → create Google OAuth client → set env vars (`.env.example`, `docs/M2_SETUP_AND_UAT.md`) → deploy Next.js → register `GOOGLE_REDIRECT_URI` → run the M2 UAT script → record exact evidence.
Use the Supabase **Transaction pooler** connection string on Vercel. Docker: `docker build .` then run with the same env vars.

## Why easy
Stateless Next.js modular monolith; persistent state in Postgres; calendars remain availability truth. No mandatory worker, Kafka, vector DB, or Kubernetes.

## Portable
Same app can run in a Node container against standard Postgres/Supabase. Add background sync only when measured latency/quotas require it.

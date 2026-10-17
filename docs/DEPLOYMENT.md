# Deployment
## Default: Vercel + Supabase
Create Supabase → run migration → create OAuth apps → set env vars → deploy Next.js → configure callbacks → run real provider smoke tests → record exact evidence.

## Why easy
Stateless Next.js modular monolith; persistent state in Postgres; calendars remain availability truth. No mandatory worker, Kafka, vector DB, or Kubernetes.

## Portable
Same app can run in a Node container against standard Postgres/Supabase. Add background sync only when measured latency/quotas require it.

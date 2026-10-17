-- M2: Google Calendar real booking.
-- 0001's `bookings` / `booking_holds` were never written by the app (booking API returned 501) and 0001 was never
-- applied to a live database (see duck/VERIFICATION_LEDGER.md). They are replaced by ONE lifecycle table so a single
-- exclusion constraint covers holds AND bookings; with two tables a hold could overlap a confirmed booking.
-- Provenance: IMPLEMENTATION-NECESSARY (duck/WHAT_CHANGED.md).

drop table if exists booking_holds;
drop table if exists bookings;

-- Hosts sign in with Google; policy lives on the host row (single host, single policy in V0).
alter table hosts
 add column if not exists google_sub text unique,
 add column if not exists email text,
 add column if not exists weekly_availability jsonb not null default
  '[{"weekday":1,"start":"09:00","end":"17:00"},{"weekday":2,"start":"09:00","end":"17:00"},{"weekday":3,"start":"09:00","end":"17:00"},{"weekday":4,"start":"09:00","end":"17:00"},{"weekday":5,"start":"09:00","end":"17:00"}]'::jsonb,
 add column if not exists buffer_before_minutes int not null default 0 check (buffer_before_minutes between 0 and 240),
 add column if not exists buffer_after_minutes int not null default 0 check (buffer_after_minutes between 0 and 240),
 add column if not exists minimum_notice_minutes int not null default 240 check (minimum_notice_minutes between 0 and 43200),
 add column if not exists horizon_days int not null default 30 check (horizon_days between 1 and 365),
 add column if not exists updated_at timestamptz not null default now();
alter table hosts add constraint hosts_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- Credentials: AES-256-GCM ciphertext (app-side key, AAD = host id). Nulled on disconnect/revocation.
alter table integration_accounts
 alter column encrypted_credentials drop not null,
 add column if not exists status text not null default 'active' check (status in ('active','revoked')),
 add constraint integration_accounts_one_per_provider unique (host_id, kind, provider);

create table bookings (
 id uuid primary key,
 host_id uuid not null references hosts(id) on delete cascade,
 calendar_account_id uuid references integration_accounts(id) on delete set null,
 provider text not null,
 status text not null check (status in ('held','pending_event','confirmed','needs_reconciliation','failed','cancelled','expired','released','consumed')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 slot tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
 hold_expires_at timestamptz,
 visitor_name text check (char_length(visitor_name) <= 120),
 visitor_email text check (char_length(visitor_email) <= 254),
 visitor_timezone text,
 notes text check (char_length(notes) <= 1000),
 title text,
 idempotency_key text,
 external_event_id text,
 external_event_url text,
 failure_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bookings_time_order check (ends_at > starts_at),
 constraint bookings_hold_expiry check (status <> 'held' or hold_expires_at is not null),
 constraint bookings_idempotency unique (host_id, idempotency_key),
 -- The double-booking guard. Statuses must match SLOT_OCCUPYING_STATUSES in src/core/domain/types.ts.
 -- Expired-but-unswept holds still occupy here; createHold sweeps them in the same transaction before inserting.
 constraint bookings_no_overlap exclude using gist (host_id with =, slot with &&)
  where (status in ('held','pending_event','confirmed','needs_reconciliation'))
);
create index bookings_host_starts on bookings (host_id, starts_at);
create index bookings_needs_attention on bookings (host_id) where status in ('pending_event','needs_reconciliation');

-- Supabase exposes `public` via its REST API to anon/authenticated keys. The app connects as the table owner
-- (server-side DATABASE_URL), which bypasses RLS; enabling RLS with no policies denies the REST API entirely.
alter table hosts enable row level security;
alter table integration_accounts enable row level security;
alter table bookings enable row level security;
alter table ai_preferences enable row level security;

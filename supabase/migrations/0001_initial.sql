create extension if not exists btree_gist;

create table if not exists hosts (
 id uuid primary key default gen_random_uuid(), slug text unique not null, display_name text not null,
 timezone text not null default 'UTC', default_duration_minutes int not null default 30 check(default_duration_minutes in (15,30,45,60)), created_at timestamptz not null default now()
);
create table if not exists integration_accounts (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references hosts(id) on delete cascade,
 kind text not null check(kind in ('calendar','mail','mcp')), provider text not null, external_account_id text,
 email text, calendar_id text, timezone text, encrypted_credentials text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists bookings (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references hosts(id) on delete cascade, provider text not null,
 external_event_id text, visitor_name text not null, visitor_email text not null, title text not null, notes text,
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null,
 status text not null default 'confirmed' check(status in ('confirmed','cancelled','rescheduled','failed')),
 idempotency_key text unique not null, created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table if not exists booking_holds (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references hosts(id) on delete cascade,
 slot tstzrange not null, expires_at timestamptz not null, status text not null default 'held' check(status in ('held','released','consumed')), created_at timestamptz not null default now()
);
alter table booking_holds add constraint no_overlapping_active_holds exclude using gist (host_id with =, slot with &&) where(status='held');
create table if not exists ai_preferences (
 host_id uuid primary key references hosts(id) on delete cascade, mode text not null default 'gateway' check(mode in ('mock','gateway','openai-compatible')),
 model_id text, credential_ref text, base_url text, updated_at timestamptz not null default now()
);

-- ============================================================
-- 052 — Error events (in-app error monitoring)
-- ============================================================
-- docs/STATUS.md debt: "No error monitoring — see failures testers don't
-- report." Client errors previously went to console.error, which means they
-- only exist in Vercel's ephemeral logs. This persists them so they can be
-- read inside the admin area, without a third-party service or account.
--
-- Rows are ROLLED UP by fingerprint: a component erroring in a render loop
-- bumps `occurrences` and `last_seen_at` on one row instead of writing
-- thousands. Super-admin read only; writes go through the service role.

create table if not exists error_events (
  id            uuid primary key default gen_random_uuid(),

  -- Grouping key: hash of source + normalised message + first stack frame.
  -- Computed in the app so the dedupe rule lives next to the code that knows
  -- which parts of a message are noise (ids, timestamps).
  fingerprint   text not null,

  source        text not null check (source in ('client', 'server')),
  message       text not null,
  stack         text,
  url           text,
  digest        text,
  context       text,
  user_agent    text,

  -- Both nullable: a client error can fire before auth resolves, and a cron
  -- run has no user. Set null on delete so history survives the account going.
  workspace_id  uuid references workspaces(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,

  occurrences   integer not null default 1,
  resolved      boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- One row per distinct problem — the upsert target.
create unique index if not exists error_events_fingerprint_key
  on error_events (fingerprint);

-- The admin list: unresolved first, most recent first.
create index if not exists error_events_triage_idx
  on error_events (resolved, last_seen_at desc);

alter table error_events enable row level security;

-- No policies: this table is super-admin-only and read through the service
-- role. RLS on with zero policies means the anon/authenticated keys see
-- nothing, which is exactly what we want for raw stack traces.

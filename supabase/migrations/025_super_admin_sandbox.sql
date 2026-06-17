-- ============================================================
-- 025 — Super Admin sandbox workspace + invite tracking
-- ============================================================

-- Mark sandbox workspaces so the app can display them differently
alter table public.workspaces
  add column if not exists is_sandbox boolean not null default false;

-- Snapshot store: super admins save a named snapshot of their sandbox
-- state (connection/skill list) for later restore during testing.
create table if not exists public.sandbox_snapshots (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text,
  -- JSON blob: { connections: [{label, connector_slug}], skills: [{name, persona}], ... }
  snapshot_data jsonb     not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.sandbox_snapshots enable row level security;

create policy "users can manage own sandbox snapshots"
  on public.sandbox_snapshots for all
  using (user_id = auth.uid());

-- Index so we can quickly fetch snapshots for one user
create index if not exists sandbox_snapshots_user_idx
  on public.sandbox_snapshots(user_id);

-- ============================================================
-- Pending super-admin invites table
-- Written immediately when the admin sends an invite.
-- Consumed by an on-accept trigger (or checked on first login).
-- ============================================================
create table if not exists public.super_admin_invites (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  invited_by uuid        references auth.users(id),
  accepted   boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.super_admin_invites enable row level security;
-- Only super admins touch this (via service role key in API routes)

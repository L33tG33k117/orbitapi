-- ============================================================
-- 045 — Persistent simulated world per connection
-- ============================================================
-- Simulation mode used to return a tiny, fixed set of hardcoded records, so any
-- query that fell outside them yielded an empty/generic result and the assistant
-- gave up (or pushed the user to connect the real API). The new sim-engine
-- (lib/sim-engine.ts) AI-generates realistic data to satisfy any query and stores
-- the evolving sandbox here, so follow-up questions stay consistent: list an
-- invoice -> open it -> mark it paid all line up across requests.
--
-- One row per simulated connection. `state` holds:
--   { "world": { ...free-form entities... }, "cache": { "<action>:<params>": <result> } }
--
-- The engine treats this table as optional: if it doesn't exist yet (migration
-- not applied), it falls back to in-process memory + the static seed data, so the
-- app keeps working. Applying this migration simply turns on cross-session memory.

create table if not exists public.simulated_world (
  connection_id uuid primary key references public.connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_simulated_world_workspace
  on public.simulated_world(workspace_id);

-- Server-only: all access goes through the service-role admin client, which
-- bypasses RLS. Enable RLS with no public policies so nothing is exposed to the
-- anon/auth roles directly.
alter table public.simulated_world enable row level security;

-- ============================================================
-- 028 — Foundation A: Workflow / Playbook execution engine
-- ============================================================
-- Playbooks are structured, multi-step flows that extend the
-- single-shot skill model with conditional branching, severity
-- thresholds, human approval gates, and pause/resume (async waits).
--
-- A playbook scopes its connections through a group (same model as
-- skills). The step graph and autonomy policy live in jsonb so the
-- engine can evolve the node types without a migration each time.
-- ============================================================

create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  description text,
  persona text not null default '',

  -- Step graph: ordered list of nodes. Each node:
  --   { id, name, type, config, next }
  -- type ∈ action | ai | condition | approval | notify | wait
  definition jsonb not null default '{"steps": []}',

  -- Severity-driven autonomy policy (the #1 differentiator):
  --   { thresholds: [ { min, max, mode } ] }
  -- mode ∈ auto | approval | notify   (what to do at a given severity)
  autonomy_policy jsonb not null default
    '{"thresholds": [
      {"min": 9, "max": 10, "mode": "auto"},
      {"min": 6, "max": 8,  "mode": "approval"},
      {"min": 0, "max": 5,  "mode": "notify"}
    ]}',

  -- How the playbook is triggered.
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'schedule', 'webhook', 'event')),
  schedule text,                      -- cron, when trigger_type = 'schedule'

  enabled boolean not null default false,
  -- Provenance: bundles and the marketplace stamp where a playbook came from.
  source text not null default 'custom'
    check (source in ('custom', 'bundle', 'marketplace')),
  source_ref text,                    -- bundle slug / marketplace listing id

  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Execution records. Unlike skill_runs these can pause: a run in
-- 'waiting' status is parked on an approval, timer, or external event
-- and resumed later (Phase 3 async chaining) via resume_token.
create table public.playbook_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  triggered_by text not null default 'manual'
    check (triggered_by in ('manual', 'schedule', 'webhook', 'chat', 'event')),
  mode text not null default 'live'
    check (mode in ('dry_run', 'live')),
  status text not null default 'running'
    check (status in ('running', 'waiting', 'completed', 'failed', 'cancelled')),

  -- Severity that drove the autonomy decision for this run (0–10).
  severity numeric,
  -- Resolved policy decision for the current severity: auto | approval | notify
  autonomy_decision text,

  -- Carried state passed between steps (the "state forward" in #6).
  state jsonb not null default '{}',
  -- Per-step execution log (params, response, duration, risk, status).
  steps jsonb not null default '[]',

  -- Pause/resume bookkeeping.
  current_step text,                  -- node id the run is parked on / executing
  waiting_on jsonb,                   -- { kind: approval|timer|event, ref, until }
  resume_token text unique,           -- opaque token to resume a parked run
  resume_at timestamptz,              -- for timer waits (cron picks these up)

  prompt text,
  summary text,
  error text,

  started_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

create index playbook_runs_workspace_idx on public.playbook_runs (workspace_id);
create index playbook_runs_playbook_idx on public.playbook_runs (playbook_id);
-- Lets the cron resume timer-parked runs efficiently.
create index playbook_runs_resume_idx on public.playbook_runs (status, resume_at)
  where status = 'waiting';

-- ------------------------------------------------------------
-- RLS (mirrors the skills/skill_runs pattern from migration 005)
-- ------------------------------------------------------------
alter table public.playbooks enable row level security;
alter table public.playbook_runs enable row level security;

create policy "Workspace members view playbooks" on public.playbooks
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage playbooks" on public.playbooks
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

create policy "Workspace members view playbook_runs" on public.playbook_runs
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage playbook_runs" on public.playbook_runs
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- ------------------------------------------------------------
-- Fix: audit_log.actor_type only allowed ('user','automation'), so the
-- existing skill-runner's actor_type='skill' inserts were silently
-- failing the CHECK. Widen it to cover skills and playbooks.
-- ------------------------------------------------------------
alter table public.audit_log drop constraint if exists audit_log_actor_type_check;
alter table public.audit_log add constraint audit_log_actor_type_check
  check (actor_type in ('user', 'automation', 'skill', 'playbook'));

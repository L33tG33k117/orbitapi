-- ============================================================
-- 005 — Connection Groups + Skills
-- ============================================================

-- Connection groups: named bundles of connections
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- Which connections belong to which group
create table public.group_connections (
  group_id uuid not null references public.groups(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  primary key (group_id, connection_id)
);

-- Skills: AI agents with a role, attached to a group
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  description text,
  persona text not null default '',
  blocked_slugs text[] not null default '{}',
  autonomy text not null default 'supervised'
    check (autonomy in ('supervised', 'autonomous')),
  schedule text,
  enabled boolean not null default false,
  created_at timestamptz default now()
);

-- Skill runs: execution history (dry-run or live)
create table public.skill_runs (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  triggered_by text not null default 'manual'
    check (triggered_by in ('manual', 'schedule', 'webhook', 'chat')),
  mode text not null default 'dry_run'
    check (mode in ('dry_run', 'live')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  prompt text,
  steps jsonb not null default '[]',
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- RLS
alter table public.groups enable row level security;
alter table public.group_connections enable row level security;
alter table public.skills enable row level security;
alter table public.skill_runs enable row level security;

-- groups: all workspace members can view; admins/owners manage
create policy "Workspace members view groups" on public.groups
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage groups" on public.groups
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- group_connections: mirrors groups policy
create policy "Workspace members view group_connections" on public.group_connections
  for select using (
    group_id in (
      select id from public.groups where workspace_id in (
        select workspace_id from public.memberships where user_id = auth.uid()
      )
    )
  );
create policy "Admins manage group_connections" on public.group_connections
  for all using (
    group_id in (
      select g.id from public.groups g
      join public.memberships m on m.workspace_id = g.workspace_id
      where m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  ) with check (true);

-- skills: all workspace members can view; admins/owners manage
create policy "Workspace members view skills" on public.skills
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage skills" on public.skills
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- skill_runs: all workspace members can view; system inserts
create policy "Workspace members view skill_runs" on public.skill_runs
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage skill_runs" on public.skill_runs
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================
-- TABLE DEFINITIONS (all tables first, then policies)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  manifest jsonb not null default '{}',
  is_simulated boolean not null default false,
  created_at timestamptz default now()
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connector_id uuid not null references public.connectors(id),
  label text not null,
  vault_secret_id text,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.connection_grants (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('read', 'read_write')),
  unique (connection_id, user_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text,
  created_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content jsonb not null,
  created_at timestamptz default now()
);

create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  connection_id uuid not null references public.connections(id),
  action_slug text not null,
  params jsonb not null default '{}',
  summary text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed')),
  expires_at timestamptz default now() + interval '10 minutes',
  created_at timestamptz default now()
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  enabled boolean not null default false,
  trigger jsonb not null,
  condition jsonb,
  actions jsonb not null default '[]',
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  trigger_payload jsonb,
  log jsonb default '[]'
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'automation')),
  actor_id uuid not null,
  connection_id uuid references public.connections(id),
  action_slug text not null,
  risk text not null check (risk in ('read', 'write', 'destructive')),
  params jsonb,
  result_status text check (result_status in ('success', 'error')),
  result_summary text,
  created_at timestamptz default now()
);

create table public.simulated_devices (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  device_name text not null,
  is_on boolean not null default false,
  brightness integer not null default 100 check (brightness between 0 and 100),
  color_temp integer default 3000,
  hex_color text default '#FFFFFF',
  scene text,
  updated_at timestamptz default now(),
  unique (connection_id, device_name)
);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.connectors enable row level security;
alter table public.connections enable row level security;
alter table public.connection_grants enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.pending_actions enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.audit_log enable row level security;
alter table public.simulated_devices enable row level security;

-- ============================================================
-- RLS POLICIES (all tables exist now)
-- ============================================================

-- profiles
create policy "Users can view profiles in their workspaces" on public.profiles
  for select using (
    id in (
      select user_id from public.memberships
      where workspace_id in (
        select workspace_id from public.memberships where user_id = auth.uid()
      )
    )
  );
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());
create policy "Service can insert profiles" on public.profiles
  for insert with check (true);

-- workspaces
create policy "Members can view their workspaces" on public.workspaces
  for select using (
    id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Owners can update workspace" on public.workspaces
  for update using (
    id in (select workspace_id from public.memberships where user_id = auth.uid() and role = 'owner')
  );
create policy "Service can insert workspaces" on public.workspaces
  for insert with check (true);

-- memberships
create policy "Members can view memberships in their workspaces" on public.memberships
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Service can manage memberships" on public.memberships
  for all using (true) with check (true);

-- connectors
create policy "Connectors are public" on public.connectors
  for select using (true);

-- connections
create policy "Workspace members can view connections" on public.connections
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins/owners can manage connections" on public.connections
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- connection_grants
create policy "Grants visible to workspace members" on public.connection_grants
  for select using (
    connection_id in (
      select id from public.connections where workspace_id in (
        select workspace_id from public.memberships where user_id = auth.uid()
      )
    )
  );
create policy "Admins/owners manage grants" on public.connection_grants
  for all using (
    connection_id in (
      select c.id from public.connections c
      join public.memberships m on m.workspace_id = c.workspace_id
      where m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  ) with check (true);

-- conversations
create policy "Users can access their conversations" on public.conversations
  for all using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
    and user_id = auth.uid()
  ) with check (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
    and user_id = auth.uid()
  );

-- messages
create policy "Users can access messages in their conversations" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  ) with check (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- pending_actions
create policy "Users see their pending actions" on public.pending_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- automations
create policy "Workspace members can view automations" on public.automations
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins/owners manage automations" on public.automations
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- automation_runs
create policy "Workspace members can view runs" on public.automation_runs
  for select using (
    automation_id in (
      select id from public.automations where workspace_id in (
        select workspace_id from public.memberships where user_id = auth.uid()
      )
    )
  );
create policy "Service can write runs" on public.automation_runs
  for insert with check (true);
create policy "Service can update runs" on public.automation_runs
  for update using (true);

-- audit_log
create policy "Workspace members can view audit log" on public.audit_log
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Service can insert audit log" on public.audit_log
  for insert with check (true);

-- simulated_devices
create policy "Workspace members can view devices" on public.simulated_devices
  for select using (
    connection_id in (
      select id from public.connections where workspace_id in (
        select workspace_id from public.memberships where user_id = auth.uid()
      )
    )
  );
create policy "Service manages devices" on public.simulated_devices
  for all using (true) with check (true);

-- ============================================================
-- TRIGGER: auto-create profile (and optionally workspace) on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_workspace_id uuid;
  v_workspace_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );

  v_workspace_name := new.raw_user_meta_data->>'workspace_name';
  if v_workspace_name is not null and v_workspace_name != '' then
    insert into public.workspaces (name) values (v_workspace_name)
    returning id into v_workspace_id;
    insert into public.memberships (workspace_id, user_id, role)
    values (v_workspace_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

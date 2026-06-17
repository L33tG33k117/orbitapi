-- suspend support on memberships
alter table public.memberships
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

-- custom roles
create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '{
    "can_use_chat": true,
    "can_view_audit": false,
    "can_approve_actions": false,
    "can_manage_skills": false,
    "can_manage_connectors": false,
    "can_view_usage": false,
    "can_manage_members": false
  }',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, name)
);

alter table public.memberships
  add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;

alter table public.custom_roles enable row level security;

create policy "workspace members can read custom roles"
  on public.custom_roles for select
  using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid()
    )
  );

create policy "workspace owner admin can manage custom roles"
  on public.custom_roles for all
  using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

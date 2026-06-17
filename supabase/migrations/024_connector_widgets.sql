create table if not exists public.connector_widgets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references public.profiles(id),
  name text not null,
  description text,
  buttons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connector_widgets_connection_idx on public.connector_widgets(connection_id);
create index connector_widgets_workspace_idx on public.connector_widgets(workspace_id);

alter table public.connector_widgets enable row level security;

create policy "workspace members can view widgets"
  on public.connector_widgets for select
  using (
    workspace_id in (
      select workspace_id from public.memberships where user_id = auth.uid()
    )
  );

create policy "workspace admins can manage widgets"
  on public.connector_widgets for all
  using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

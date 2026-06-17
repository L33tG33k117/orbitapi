create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- null = visible to all admins/owners in the workspace; set to target a specific user
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('skill_completed', 'skill_failed', 'pending_action', 'info')),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

-- Users see their own notifications + workspace-wide ones (user_id IS NULL)
create policy "Users see relevant notifications" on public.notifications
  for select to authenticated using (
    workspace_id in (
      select workspace_id from public.memberships where user_id = auth.uid()
    )
    and (user_id is null or user_id = auth.uid())
  );

create policy "Users mark their notifications read" on public.notifications
  for update to authenticated using (
    workspace_id in (
      select workspace_id from public.memberships where user_id = auth.uid()
    )
    and (user_id is null or user_id = auth.uid())
  )
  with check (true);

-- Service role can insert/manage all notifications
create policy "Service manages notifications" on public.notifications
  for all to service_role using (true) with check (true);

-- Index for fast unread count lookup
create index notifications_workspace_read_idx on public.notifications (workspace_id, read, created_at desc);

-- The memberships SELECT policy referenced memberships within itself,
-- causing infinite recursion. Fix: a security definer function bypasses
-- RLS when it runs, breaking the cycle.

create or replace function public.get_my_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.memberships where user_id = auth.uid()
$$;

drop policy if exists "Members can view memberships in their workspaces" on public.memberships;
drop policy if exists "Members can view workspace memberships" on public.memberships;

create policy "Members can view workspace memberships" on public.memberships
  for select using (workspace_id in (select public.get_my_workspace_ids()));

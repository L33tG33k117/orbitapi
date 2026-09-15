-- ============================================================
-- 058 — Workspace isolation guards
-- ============================================================
-- API routes write with the service-role key, which skips RLS. So nothing at
-- the database level stopped a group (or a playbook/skill pointing at a group)
-- from referencing a row that belongs to a DIFFERENT workspace. The app now
-- checks this in lib/workspace-guard.ts; these triggers make the database
-- refuse it too, so a future route that forgets the check still can't leak.
--
-- Before applying to production, find any existing cross-workspace rows (the
-- triggers only check new writes):
--
--   select gc.* from group_connections gc
--     join groups g on g.id = gc.group_id
--     join connections c on c.id = gc.connection_id
--    where g.workspace_id <> c.workspace_id;
--
--   select p.id from playbooks p join groups g on g.id = p.group_id
--    where p.workspace_id <> g.workspace_id;
--
--   select s.id from skills s join groups g on g.id = s.group_id
--    where s.workspace_id <> g.workspace_id;
-- ============================================================

create or replace function public.enforce_group_connection_workspace()
returns trigger
language plpgsql
as $$
begin
  if (select workspace_id from public.groups where id = new.group_id)
     is distinct from
     (select workspace_id from public.connections where id = new.connection_id) then
    raise exception 'group % and connection % belong to different workspaces',
      new.group_id, new.connection_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists group_connections_same_workspace on public.group_connections;
create trigger group_connections_same_workspace
  before insert or update on public.group_connections
  for each row execute function public.enforce_group_connection_workspace();

create or replace function public.enforce_group_ref_workspace()
returns trigger
language plpgsql
as $$
begin
  if new.group_id is not null and
     (select workspace_id from public.groups where id = new.group_id) is distinct from new.workspace_id then
    raise exception '% % references a group from another workspace', tg_table_name, new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists playbooks_group_same_workspace on public.playbooks;
create trigger playbooks_group_same_workspace
  before insert or update of group_id, workspace_id on public.playbooks
  for each row execute function public.enforce_group_ref_workspace();

drop trigger if exists skills_group_same_workspace on public.skills;
create trigger skills_group_same_workspace
  before insert or update of group_id, workspace_id on public.skills
  for each row execute function public.enforce_group_ref_workspace();

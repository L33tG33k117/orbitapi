-- 050: let connections be deleted without tripping FK constraints.
-- Beta feedback (2026-07-12): deleting a connection failed with
--   "violates foreign key constraint audit_log_connection_id_fkey".
-- audit_log keeps its rows (history must survive the connection);
-- pending_actions rows are meaningless without their connection.

alter table public.audit_log
  drop constraint if exists audit_log_connection_id_fkey;
alter table public.audit_log
  add constraint audit_log_connection_id_fkey
  foreign key (connection_id) references public.connections(id) on delete set null;

alter table public.pending_actions
  drop constraint if exists pending_actions_connection_id_fkey;
alter table public.pending_actions
  add constraint pending_actions_connection_id_fkey
  foreign key (connection_id) references public.connections(id) on delete cascade;

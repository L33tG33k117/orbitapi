-- ============================================================
-- 044 — Workspace-level connection deletion policy
-- ============================================================
-- Testers noted that "delete vs trash" felt like a platform policy, not a
-- personal preference an admin might want to control. Add a workspace default
-- and a lock: when locked, members can't override it (their per-user
-- connection_delete_preference is ignored and the workspace default applies).
-- Default = 'trash', unlocked → existing behavior (users choose) is preserved.

alter table public.workspaces
  add column if not exists connection_delete_default text not null default 'trash'
  check (connection_delete_default in ('trash', 'permanent'));

alter table public.workspaces
  add column if not exists connection_delete_locked boolean not null default false;

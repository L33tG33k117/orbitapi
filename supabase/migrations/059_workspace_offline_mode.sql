-- ============================================================
-- 059 — Offline mode switch for cloud workspaces
-- ============================================================
-- An Enterprise customer who moves to the self-hosted (offline) edition keeps
-- their cloud account: that is where they download installers, updates and
-- their licence. But the cloud workspace must stop acting like the live one,
-- or people change a connector or playbook here expecting it to reach the
-- offline install (it never will), and scheduled playbooks run twice.
--
-- offline_mode = true pauses the online product for that workspace (UI grays it
-- out, execution APIs and the cloud scheduler skip it). It is reversible.
-- Additive and idempotent; code treats a missing column as false.
-- ============================================================

alter table public.workspaces
  add column if not exists offline_mode boolean not null default false,
  add column if not exists offline_mode_changed_at timestamptz,
  add column if not exists offline_mode_changed_by uuid references auth.users(id) on delete set null;

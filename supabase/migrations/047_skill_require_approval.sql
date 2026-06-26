-- ============================================================
-- 047 — Optional approval gate for skills
-- ============================================================
-- Skills running live (Manual/Autonomous) executed write/destructive actions
-- immediately, with no human checkpoint — unlike chat and playbooks, which stage
-- writes for approval. This adds an opt-in gate: when on, a skill's write actions
-- are staged into the Approvals inbox (pending_actions) for an admin/owner to
-- approve before they run.
--
-- Default false = unchanged behavior. Code treats a missing column as false, so
-- this migration is safe to apply at any time.

alter table public.skills
  add column if not exists require_approval boolean not null default false;

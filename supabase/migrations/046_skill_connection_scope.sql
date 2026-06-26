-- ============================================================
-- 046 — Per-connection skill scoping
-- ============================================================
-- Skills could only be scoped to "all connections" or a whole group. Users
-- wanted to pick the exact connections a skill may use ("only this one and that
-- one") right in the Skill Builder. This adds an optional allow-list of
-- connection ids on the skill.
--
-- Semantics: NULL or empty {} = no per-connection restriction (use the group /
-- all connections, as before). A non-empty array limits the skill to exactly
-- those connections (intersected with any group scope). Code treats a missing
-- column as "no restriction", so this migration is safe to apply any time.

alter table public.skills
  add column if not exists connection_ids uuid[];

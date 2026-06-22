-- ============================================================
-- 043 — Per-connector access controls (RBAC by action risk)
-- ============================================================
-- Let admins cap which classes of action a connection may perform: read,
-- write, destructive. Enforced server-side in the chat tools, the manual
-- execute endpoint, and the skill/playbook runners.
--
-- Default = all three allowed, so existing connections behave exactly as before
-- until someone restricts them. NULL is also treated as "all allowed" in code.

alter table public.connections
  add column if not exists allowed_risk_levels text[] not null
  default array['read', 'write', 'destructive']::text[];

-- ============================================================
-- 049 — Governance audit events
-- ============================================================
-- Audit Log becomes a true governance/compliance trail: WHO changed WHAT
-- (settings, members, connector config & access), distinct from Activity (which
-- shows what ran + outputs). Action-level records still live in audit_log; these
-- capture configuration/administrative changes.
--
-- Written via the service-role API only (RLS on, no policies). Code that logs
-- events degrades gracefully if this table is missing, so it's safe to apply late.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  category text not null,          -- members | connector | access | workspace | security | billing | automation
  action text not null,            -- e.g. member.role_changed, connector.credentials_updated
  target text,                     -- human label of what was affected
  summary text not null,           -- one-line human description
  metadata jsonb,                  -- before/after or extra detail
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

create index if not exists audit_events_ws_created_idx
  on public.audit_events (workspace_id, created_at desc);

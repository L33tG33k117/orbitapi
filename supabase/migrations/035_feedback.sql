-- ============================================================
-- 035 — Beta feedback
-- ============================================================
-- Lightweight in-app feedback from testers. Written via the service-role
-- API; read by super admins. RLS on with no policies = locked to service role.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

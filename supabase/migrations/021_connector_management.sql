-- Track when a build was applied to the codebase
alter table public.connector_builds
  add column if not exists applied_at timestamptz;

-- ── Connector overrides: per-slug disable/enable ──────────────────────────────
create table if not exists public.connector_overrides (
  slug              text primary key,
  disabled          boolean not null default false,
  disabled_reason   text,
  disabled_by       uuid references auth.users(id),
  disabled_at       timestamptz,
  updated_at        timestamptz default now()
);

alter table public.connector_overrides enable row level security;

-- Only service role can manage overrides; users read via API
create policy "Service role manages overrides"
  on public.connector_overrides for all to service_role using (true) with check (true);

-- ── Connector reports: user-submitted issues ──────────────────────────────────
create table if not exists public.connector_reports (
  id               uuid primary key default gen_random_uuid(),
  connector_slug   text not null,
  connector_name   text not null,
  user_id          uuid not null references auth.users(id),
  workspace_id     uuid not null references public.workspaces(id),
  what_wrong       text not null,          -- mandatory description
  error_message    text,                   -- optional error/log text
  status           text not null default 'open'
                     check (status in ('open', 'investigating', 'resolved')),
  admin_note       text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.connector_reports enable row level security;

create policy "Users can submit reports"
  on public.connector_reports for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can view their own reports"
  on public.connector_reports for select to authenticated
  using (user_id = auth.uid());

create policy "Service role manages all reports"
  on public.connector_reports for all to service_role using (true) with check (true);

create index if not exists connector_reports_slug_idx on public.connector_reports(connector_slug);
create index if not exists connector_reports_status_idx on public.connector_reports(status);

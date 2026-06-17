-- ============================================================
-- 016 — Add status + admin notes to connector_requests
-- ============================================================

alter table public.connector_requests
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists admin_notes text,
  add column if not exists updated_at timestamptz default now();

create index if not exists connector_requests_status_idx
  on public.connector_requests(status);

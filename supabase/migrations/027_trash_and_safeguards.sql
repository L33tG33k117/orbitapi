-- ============================================================
-- 027 — Connection trash bin + profile delete preference
-- ============================================================

-- 1. Extend connections.status to include 'trashed'
alter table public.connections
  drop constraint if exists connections_status_check;

alter table public.connections
  add constraint connections_status_check
  check (status in ('active', 'error', 'disconnected', 'trashed'));

-- 2. Add trashed_at timestamp
alter table public.connections
  add column if not exists trashed_at timestamptz;

-- Index for efficient trash queries / cleanup
create index if not exists connections_trashed_idx
  on public.connections(trashed_at)
  where status = 'trashed';

-- 3. User preference: 'trash' (default) or 'permanent' when deleting connections
alter table public.profiles
  add column if not exists connection_delete_preference text
  not null default 'trash'
  check (connection_delete_preference in ('trash', 'permanent'));

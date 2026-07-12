-- 051: per-action permission policies on a connection (beta feedback 2026-07-12).
-- Map of action_slug -> 'auto' | 'approve' | 'never'. Absent slug = default
-- behavior (reads run, chat writes confirm, skill/MCP approval gates as before).
alter table public.connections
  add column if not exists action_policies jsonb not null default '{}'::jsonb;

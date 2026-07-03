-- ============================================================
-- 048 — Per-connection API exploration toggle
-- ============================================================
-- The connector factory adds a read-only "explore_api" action that can GET any
-- endpoint of a vendor's API (the "reach the whole API" capability). It's already
-- governed by risk class, host-locked, and audited — but an admin may want to keep
-- the curated shortcuts while disabling open-ended exploration on a sensitive
-- connection (secrets manager, identity provider). This flag expresses that.
--
-- Default true = current behavior (exploration on). Code treats a missing column
-- or NULL as allowed, so this migration is safe to apply late.

alter table public.connections
  add column if not exists allow_api_exploration boolean not null default true;

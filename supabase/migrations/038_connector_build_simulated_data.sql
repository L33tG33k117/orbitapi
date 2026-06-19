-- ============================================================
-- 038 — Persist generated simulation data with each connector build
-- ============================================================
-- So a connector built from a request works in Simulate mode with realistic
-- fake responses (not the generic stub). Written into lib/simulate-action.ts
-- on apply; stored here so a manual re-apply has the same data available.

alter table public.connector_builds
  add column if not exists simulated_data jsonb;

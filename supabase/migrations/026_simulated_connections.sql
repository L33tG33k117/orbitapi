-- ============================================================
-- 026 — Simulated connections flag
-- ============================================================
-- Allows any connector to be connected in "simulated" mode.
-- In simulated mode: no real API credentials, actions return
-- plausible fake data from the simulation engine.
-- A simulated connection can be converted to real at any time —
-- all skills, groups, and grants are preserved.

alter table public.connections
  add column if not exists is_simulated boolean not null default false;

create index if not exists connections_simulated_idx
  on public.connections(is_simulated)
  where is_simulated = true;

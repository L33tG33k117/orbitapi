-- ============================================================
-- 033 — Entitlements override reset, per-workspace credit override,
--       and a DB-backed rate limiter
-- ============================================================

-- ── feature_flags now means "overrides", not "all features on" ──────────
-- New semantics (lib/entitlements.ts): a key in feature_flags grants (true)
-- or revokes (false) a capability; absent keys fall back to the tier default.
-- An empty object means "use tier defaults". Reset existing rows (pre-launch)
-- so legacy all-true flags don't accidentally grant paid features to free.
alter table public.workspaces alter column feature_flags set default '{}'::jsonb;
update public.workspaces set feature_flags = '{}'::jsonb;

-- ── Per-workspace AI credit override ────────────────────────────────────
-- When set, replaces the tier's monthly credit allowance for this workspace
-- (enterprise custom deals, comped testers, etc.). Null = use tier default.
alter table public.workspaces add column if not exists ai_credit_override integer;

-- ── Rate limiter (fixed window) ─────────────────────────────────────────
-- A small atomic counter keyed by an arbitrary bucket string. Used to throttle
-- request floods on AI endpoints (spend is already capped by AI Power credits).
create table if not exists public.rate_limits (
  bucket text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- Returns true if the call is allowed (within limit), false if it should be
-- rejected. Resets the window when it has elapsed. SECURITY DEFINER so the
-- admin client can call it.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (bucket, count, window_start)
    values (p_bucket, 1, now())
  on conflict (bucket) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

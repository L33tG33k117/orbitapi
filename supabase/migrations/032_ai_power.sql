-- ============================================================
-- 032 — AI Power (credits) + efficiency
-- ============================================================
-- Customers consume a monthly credit allowance (set by their plan,
-- enforced by us) instead of seeing raw model cost. Efficiency
-- (Maximum/Balanced/Economy) replaces model choice — no vendor or
-- model name is ever shown. Internal cost (cost_usd, migration 029)
-- is converted to credits in app code.
-- ============================================================

alter table public.workspaces add column if not exists ai_credits_used integer not null default 0;
alter table public.workspaces add column if not exists ai_topup_credits integer not null default 0;
alter table public.workspaces add column if not exists ai_credits_cycle_start timestamptz default now();
alter table public.workspaces add column if not exists ai_efficiency text not null default 'balanced'
  check (ai_efficiency in ('maximum', 'balanced', 'economy'));

-- Per-skill override (null = inherit the workspace default efficiency).
alter table public.skills add column if not exists ai_efficiency text
  check (ai_efficiency in ('maximum', 'balanced', 'economy'));

-- Atomic credit consumption with monthly cycle reset. SECURITY DEFINER so the
-- runners' admin client can call it.
create or replace function public.consume_ai_credits(p_workspace_id uuid, p_credits integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  elapsed boolean;
begin
  select (ai_credits_cycle_start is null or ai_credits_cycle_start < now() - interval '30 days')
    into elapsed
  from public.workspaces where id = p_workspace_id;

  if elapsed then
    update public.workspaces
      set ai_credits_used = greatest(0, p_credits),
          ai_topup_credits = 0,
          ai_credits_cycle_start = now()
      where id = p_workspace_id;
  else
    update public.workspaces
      set ai_credits_used = ai_credits_used + greatest(0, p_credits)
      where id = p_workspace_id;
  end if;
end;
$$;

-- Grant purchased top-up credits (called from the billing webhook).
create or replace function public.grant_ai_topup(p_workspace_id uuid, p_credits integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.workspaces
  set ai_topup_credits = ai_topup_credits + greatest(0, p_credits)
  where id = p_workspace_id;
$$;

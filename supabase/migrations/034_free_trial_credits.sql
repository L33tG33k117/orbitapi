-- ============================================================
-- 034 — Free tier = one-time trial credits (no monthly refill)
-- ============================================================
-- Free workspaces get a fixed, one-time pool of AI credits that never
-- resets, so a free workspace never becomes a recurring AI cost. Paid
-- tiers keep the 30-day cycle reset. This updates consume_ai_credits to
-- skip the reset for free-tier workspaces (allowance amount is enforced
-- in app code via getAiPower / FREE_TRIAL_CREDITS).

create or replace function public.consume_ai_credits(p_workspace_id uuid, p_credits integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  elapsed boolean;
begin
  select tier,
         (ai_credits_cycle_start is null or ai_credits_cycle_start < now() - interval '30 days')
    into v_tier, elapsed
  from public.workspaces where id = p_workspace_id;

  -- Free tier is a one-time trial pool — never reset it.
  if elapsed and v_tier is distinct from 'free' then
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

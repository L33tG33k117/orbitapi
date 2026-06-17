-- ============================================================
-- 029 — Foundation B: Enriched execution records
-- ============================================================
-- Captures enough about every executed action to (a) replay it
-- (#5), (b) show a destructive-action preview + rollback reasoning
-- (#9), and (c) attribute LLM token cost per run (#8).
-- ============================================================

-- ------------------------------------------------------------
-- audit_log: capture full response, latency, and the actor's
-- human label so the replay UI can render a complete detail card.
-- ------------------------------------------------------------
alter table public.audit_log add column if not exists response jsonb;
alter table public.audit_log add column if not exists duration_ms integer;
alter table public.audit_log add column if not exists actor_label text;
-- A run/correlation id so replayed actions can be grouped with their origin.
alter table public.audit_log add column if not exists run_id uuid;
-- Was this action produced by a replay of an earlier audit entry?
alter table public.audit_log add column if not exists replay_of uuid references public.audit_log(id);

create index if not exists audit_log_workspace_created_idx
  on public.audit_log (workspace_id, created_at desc);

-- ------------------------------------------------------------
-- LLM cost attribution on both run tables (#8 cost optimizer).
-- ------------------------------------------------------------
alter table public.skill_runs add column if not exists model text;
alter table public.skill_runs add column if not exists tokens_in integer not null default 0;
alter table public.skill_runs add column if not exists tokens_out integer not null default 0;
alter table public.skill_runs add column if not exists cost_usd numeric(10, 6) not null default 0;

alter table public.playbook_runs add column if not exists model text;
alter table public.playbook_runs add column if not exists tokens_in integer not null default 0;
alter table public.playbook_runs add column if not exists tokens_out integer not null default 0;
alter table public.playbook_runs add column if not exists cost_usd numeric(10, 6) not null default 0;

-- ------------------------------------------------------------
-- Per-workspace and per-skill monthly token/cost budgets (#8).
-- A null budget means "no cap". Enforcement lives in app code.
-- ------------------------------------------------------------
alter table public.workspaces add column if not exists monthly_cost_budget_usd numeric(10, 2);
alter table public.skills add column if not exists monthly_cost_budget_usd numeric(10, 2);
-- Preferred model override per skill (lets the optimizer route cheap work down).
alter table public.skills add column if not exists model text;

-- ------------------------------------------------------------
-- Additive cost accounting for playbook runs. The engine calls this
-- after each LLM step so that resuming a parked run accumulates cost
-- rather than overwriting it. SECURITY DEFINER so the engine's admin
-- client can call it; callers pass a run id they already control.
-- ------------------------------------------------------------
create or replace function public.increment_playbook_run_cost(
  p_run_id uuid,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost numeric,
  p_model text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.playbook_runs
  set tokens_in = tokens_in + coalesce(p_tokens_in, 0),
      tokens_out = tokens_out + coalesce(p_tokens_out, 0),
      cost_usd = cost_usd + coalesce(p_cost, 0),
      model = coalesce(p_model, model),
      updated_at = now()
  where id = p_run_id;
$$;

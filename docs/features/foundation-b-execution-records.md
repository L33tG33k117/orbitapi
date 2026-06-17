# Foundation B — Enriched Execution Records

**Status:** Complete (live, migration 029 applied)

## Summary
Captures enough about every executed action and AI run to (a) replay it (#5), (b) preview
destructive impact + log rollback reasoning (#9), and (c) attribute AI cost per run (#8 / AI Power).

## How it works
- Every write action now records its **full response, latency, and a replay link** to `audit_log`.
- Every skill/playbook run records **model, tokens_in, tokens_out, cost_usd**.
- `lib/usage-cost.ts` is the single source of model pricing + cost math (internal only; never shown).
- Playbook runs accumulate cost additively across steps/resumes via the `increment_playbook_run_cost` RPC.

## Key files
- `lib/usage-cost.ts` — `MODEL_PRICING`, `computeCost`, `normalizeUsage` (AI SDK usage shape)
- `lib/skill-runner.ts`, `lib/playbook-runner.ts` — record cost per run
- `app/api/execute/route.ts`, `app/api/approvals/[id]/approve/route.ts` — write response/duration/replay_of

## Data model (migration 029_execution_records.sql)
- `audit_log` + `response` (jsonb), `duration_ms`, `actor_label`, `run_id`, `replay_of` (FK self)
- `skill_runs` / `playbook_runs` + `model`, `tokens_in`, `tokens_out`, `cost_usd`
- `workspaces.monthly_cost_budget_usd`, `skills.monthly_cost_budget_usd`, `skills.model` (later superseded by efficiency)
- RPC `increment_playbook_run_cost(run_id, tokens_in, tokens_out, cost, model)`

## Gotchas
- Pricing table in `usage-cost.ts` must be kept in sync with Anthropic pricing (per-MTok).
- `cost_usd` is an estimate from AI SDK token usage × pricing — not Anthropic's actual invoice.
- This data feeds AI Power (#8) which converts cost → credits; users never see the dollar figures.

# #8 — AI Power (Credits + Efficiency Monetization)

**Status:** Complete (live, migration 032 applied). Evolved from the "cost optimizer" idea.

## Summary
Customer-facing monetization of AI usage. Customers get a monthly **credit** allowance per plan
(enforced by us, hidden); when out, they upgrade or buy top-up packs (we keep margin). Model choice is
abstracted as **Efficiency** (Maximum/Balanced/Economy). **Anthropic and model names are never shown.**

## How it works
- **All business knobs in `lib/ai-power.ts`:** `EFFICIENCY_MODEL` (maximum→opus-4-8, balanced→sonnet-4-6,
  economy→haiku-4-5), `TIER_MONTHLY_CREDITS` (free **0** / starter 15k / pro 60k / enterprise 1M; 1 credit =
  $0.001 internal cost), `FREE_TRIAL_CREDITS` (one-time pool for free; default 500 ≈ $0.50),
  `TOPUP_PACKS` ($25→20k, $50→42k, $100→90k; ~20% margin), `TIER_MIN_POLL_HOURS` (free 24 / starter 6 / pro 1).
- **Free = one-time trial, NOT a monthly grant.** Free workspaces get `FREE_TRIAL_CREDITS` once; the pool
  never refills (so free is never a recurring AI cost). `getAiPower` sets `isTrial=true` for free, `resetInDays=0`,
  and `consume_ai_credits` (migration 034) skips the 30-day reset for free-tier workspaces. Paid tiers reset monthly.
  An admin `ai_credit_override` still wins over the trial/tier amount.
- **Consumption:** runners compute `cost_usd` → `consumeCredits()` → `consume_ai_credits` RPC (atomic,
  30-day cycle reset). Efficiency (per-skill override → workspace default) selects the model via `modelFor()`.
- **Enforcement:** runners throw `OUT_OF_AI_POWER` when `remaining<=0`; run APIs return 402 + friendly
  message; chat returns 402; cron skips out-of-power workspaces.
- **Reset:** `getAiPower()` returns `resetInDays`; allowance + top-ups reset each cycle (no carry-over).
- **Top-ups:** `/api/billing/topup` (Stripe payment-mode) → webhook `grant_ai_topup` on
  checkout.session.completed with `metadata.topup_credits`.

## Key files
- `lib/ai-power.ts` — knobs, `getAiPower`, `consumeCredits`, `hasAiPower`, `modelFor`, `OUT_OF_AI_POWER`
- `app/(dashboard)/ai-power/page.tsx`, `ai-power-client.tsx` — meter + reset countdown + packs + efficiency
- `app/api/ai-power/route.ts` (settings), `app/api/billing/topup/route.ts`, `app/api/billing/webhook/route.ts`
- Runners + chat consume credits; crons enforce `TIER_MIN_POLL_HOURS`
- `/costs` now redirects to `/ai-power`

## Data model (migration 032_ai_power.sql)
- `workspaces` + ai_credits_used, ai_topup_credits, ai_credits_cycle_start, ai_efficiency
- `skills.ai_efficiency` (null = inherit workspace default)
- RPCs `consume_ai_credits` (atomic + reset), `grant_ai_topup`

## Gotchas
- Top-up credits currently DO NOT carry over (reset with the cycle). Changing this = edit the reset
  branch in `consume_ai_credits`.
- Top-ups need Stripe env vars to charge live (button returns "billing not configured" otherwise).
- Prompt caching (see prompt-caching.md) is the unit-economics lever that makes allowances generous + profitable.

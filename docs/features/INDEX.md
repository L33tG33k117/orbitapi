# OrbitAPI — Feature Reference Index

One markdown file per completed feature, for quick recall and grep-based search.
Each file follows the same shape: **Status · Summary · How it works · Key files · Data model · API · Gotchas**.

> Convention: feature docs are named `<area>-<slug>.md`. Search this folder by keyword
> (e.g. `grep -ril "severity" docs/features`) to find the relevant doc fast.

## Foundations (shared infrastructure)
- [foundation-a-workflow-engine.md](foundation-a-workflow-engine.md) — playbook step-graph execution engine, severity→autonomy, park/resume
- [foundation-b-execution-records.md](foundation-b-execution-records.md) — enriched audit (response/duration/replay), per-run token cost
- [foundation-c-bundles-primitive.md](foundation-c-bundles-primitive.md) — serialize/install/export bundle manifests
- [foundation-d-webhook-registry.md](foundation-d-webhook-registry.md) — HMAC-signed inbound webhooks + delivery log + dispatch

## Game-changer features
- [playbooks-autonomy.md](playbooks-autonomy.md) — #1 autonomous response playbooks with approval chains
- [connector-schema-discovery.md](connector-schema-discovery.md) — #2 AI connector schema discovery
- [data-mapping.md](data-mapping.md) — #3 AI cross-connector data mapping
- [marketplace.md](marketplace.md) — #4 skill/bundle marketplace with revenue share
- [action-replay.md](action-replay.md) — #5 real-time action replay
- [async-chaining.md](async-chaining.md) — #6 conditional skill chaining with async state
- [vertical-bundles.md](vertical-bundles.md) — #7 Security SOC / Support Ops / Property Mgmt bundles
- [ai-power.md](ai-power.md) — #8 AI Power (credits + efficiency monetization, evolved from cost optimizer)
- [destructive-preview.md](destructive-preview.md) — #9 destructive action preview + rollback reasoning
- [webhook-dashboard.md](webhook-dashboard.md) — #10 webhook signature validation dashboard

## Platform / cross-cutting
- [prompt-caching.md](prompt-caching.md) — Anthropic prompt caching across all AI calls (unit economics)
- [ui-revamp.md](ui-revamp.md) — Orbit/Space theme, design tokens, grouped sidebar
- [help-guide.md](help-guide.md) — in-app user Help Guide
- [naming-api-connectors.md](naming-api-connectors.md) — user-facing "API Connectors" naming convention
- [tier-gating.md](tier-gating.md) — plan tiers → capabilities, per-workspace overrides, Unlock UX, admin controls
- [deployment-hardening.md](deployment-hardening.md) — beta guardrails (signup gating, rate limiting, crons) + Vercel/Supabase deploy (see also `docs/DEPLOYMENT.md`)

## Migrations map
| # | File | Feature |
|---|------|---------|
| 028 | playbooks | Foundation A |
| 029 | execution_records | Foundation B |
| 030 | bundles_marketplace | Foundation C + #4 |
| 031 | webhooks | Foundation D + #10 |
| 032 | ai_power | #8 AI Power |
| 033 | entitlements_and_limits | Tier gating + rate limiter + credit override |
| 034 | free_trial_credits | Free = one-time trial credits (no monthly refill) |

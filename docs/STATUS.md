# OrbitAPI — Status & Next Steps (2026-06-17)

Snapshot of where the product is the night beta testing began, and the prioritized roadmap.

## Where we are
- **Beta is LIVE** at `https://orbitapi-eosin.vercel.app` (Vercel, free/Hobby tier), invite-gated
  (`SIGNUP_INVITE_CODE`). GitHub → Vercel auto-deploys on every push to `main`.
- **Auth/data:** Supabase (migrations through **035** applied). ⚠️ Beta runs on the **same Supabase
  project used for local dev** — split this before serious iteration.
- **Monetization model in place:** tier entitlements + per-workspace overrides; AI Power as
  customer-facing credits (vendor/model hidden); **Free = one-time trial** (never a recurring cost);
  Free "taste" = 3 connectors + 1 manual skill; scheduling/autonomy/playbooks/etc. are paid.
- **Beta ops:** in-app **Feedback** button → `feedback` table → super-admin viewer; admin can comp
  testers to Pro (tier + credit override) without Stripe.
- **Quality:** `tsc` + `next build` green; recent fixes — hydration guards (theme/window), admin role
  dropdown portal (clipping), connector catalog "coming soon" honesty, and a **mobile pass**
  (sidebar→drawer + hamburger, responsive grids, button wrapping).

## Known gaps / tech debt
- **Shared dev/prod database** — testers and local dev share one Supabase. Split soon.
  ⚠️ Still open — needs a second Supabase project (account-level, not something the agent can do).
- **Mobile** — structural nav fixed; individual screens still need polish (drive by tester feedback).
- ~~**No error monitoring**~~ ✅ **SHIPPED 2026-08-02** — in-app error log instead of Sentry, so
  there's no second account to check. `error_events` table (migration **052**, applied),
  `lib/error-log.ts` captures client errors via `/api/log-error` and server errors from the chat
  route + skill/playbook runners, rolled up by fingerprint so one repeating bug is one row.
  Read at **/admin/errors** with an unresolved-count badge in the admin nav. Every write is
  best-effort and never throws; if the migration is missing it falls back to `console.error`
  and the page says so.
- ~~**Resilient AI errors**~~ ✅ **SHIPPED 2026-08-02** — `lib/ai-resilience.ts`. Three layers:
  `maxRetries: 3` on every AI call site (up from the SDK default of 2, with exponential backoff);
  `withModelFallback()` reruns on the Economy model when the primary is still 529-overloaded, and
  bills whichever model actually answered; `friendlyAiError()` turns provider payloads into a plain
  sentence. Chat gets retries + friendly copy but **not** model fallback — once the stream is
  flushing there's no way to rewind and re-answer without the user seeing two half-replies.
- **Stripe not live** — fine (comp via admin), wire when ready to charge.
- **Secrets in transcript** — Vercel token + Supabase/Anthropic keys were pasted during setup,
  plus the `SUPABASE_ACCESS_TOKEN` pasted 2026-07-03. ⚠️ Still open — rotation is account-level.
- **Crons daily** (Hobby limit) — scheduled skills/playbooks fire once/day until a paid Vercel plan.
  Both cron slots are used, so the daily model check runs as a GitHub Action instead.
- ⚠️ **Vercel auto-deploy stopped firing after 2026-07-12** — commits kept landing on `main`,
  GitHub recorded no Deployment, and nothing reached production for three weeks. Mitigated by a
  `deploy` job in `.github/workflows/ci.yml` that deploys from CI (gated on the quality checks),
  which needs a `VERCEL_TOKEN` repo secret. The underlying Vercel↔GitHub integration should still
  be reconnected in the Vercel dashboard.

## Models
Current: **Opus 5** (maximum) · **Sonnet 5** (balanced, default) · **Haiku 4.5** (economy) ·
Fable 5 available as an explicit per-skill override only. Migrated 2026-08-02 from Opus 4.8 /
Sonnet 4.6.

**The thing to know:** Opus 5 and Sonnet 5 think *by default*, and thinking is billed as output
and shares the `max_tokens` budget. `lib/ai-resilience.ts` therefore defines an explicit policy —
`NO_THINKING` for short structured one-shots (connector builds, field mappings, verify verdicts,
widget configs, previews, sim data) so their tight budgets aren't eaten, and `AGENTIC_THINKING`
plus `AGENTIC_MAX_TOKENS` for chat, skills and playbooks where reasoning between tool calls is
the point. Expect agentic runs to consume somewhat more AI Power than on 4.8/4.6 in exchange for
better tool use. Sonnet 5 also uses a new tokenizer (~30% more tokens for the same text), so
`lib/ai-estimate.ts` profiles run a little optimistic — re-baseline if estimates start drifting.

`npm run check:models` (and a daily GitHub Action) flags retirements and newer releases.
Upgrading stays manual on purpose: the Models API doesn't publish prices, so `MODEL_PRICING` must
be updated by hand, and each generation has carried breaking changes.

## What to work on next (prioritized)
1. **Run the beta feedback loop** (now active) — triage tester input, fix high-signal issues fast.
2. **Mobile polish round 2** — based on what the testers actually hit.
3. **Resilient AI errors** — small, high-value reliability win before testers see a raw 529.
4. **Split dev/prod Supabase** — protect tester data from dev churn.
5. **Error monitoring (Sentry)** — see failures testers don't report.
6. **⭐ Data Liberation (the flagship)** — bulk/historical export past app-UI limits
   (auto-pagination + CSV/Sheets/email + cross-app joins). The clearest reason to choose OrbitAPI;
   see `docs/REVIEW.md`.
7. **Onboarding/first-run** — nail connect → ask → save-skill on first session.
8. **Assistant polish** — tailored starter prompts from connected apps; render results as tables
   with Copy/Export.

## Suggested sequence
This week = beta health (1–5). Then the differentiator (6) once the base feels solid. Lead all
messaging with the limitation-breaking promise (Data Liberation).

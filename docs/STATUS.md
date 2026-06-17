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
- **Mobile** — structural nav fixed; individual screens still need polish (drive by tester feedback).
- **No error monitoring** — add Sentry (or alerting on the existing log endpoint) for the beta.
- **Resilient AI errors** — the friendly "Orbit's AI is busy, retrying…" + Economy fallback on 529s
  was discussed but never shipped; testers will eventually hit a raw provider error.
- **Stripe not live** — fine (comp via admin), wire when ready to charge.
- **Secrets in transcript** — Vercel token + Supabase/Anthropic keys were pasted during setup;
  revoke the Vercel token now, rotate the others after the beta.
- **Crons daily** (Hobby limit) — scheduled skills/playbooks fire once/day until a paid Vercel plan.

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

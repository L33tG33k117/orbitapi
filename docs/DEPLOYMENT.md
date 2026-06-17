# OrbitAPI — Deployment & Beta Launch Checklist

How to get OrbitAPI online for external testers on **Vercel + Supabase**, and the
guardrails to set before strangers can sign in.

---

## 1. Architecture

- **Frontend/API:** Next.js 16 (App Router) on **Vercel**.
- **Database/Auth/Storage:** **Supabase** (Postgres + RLS + Vault).
- **AI provider:** Anthropic (server-only; never exposed in the UI — see IP notes).
- **Billing:** Stripe (subscriptions + one-time AI Power top-ups). Optional.

Recommended: run **two Supabase projects** — one **prod**, one **staging** — so testers
never touch data you're still developing against. Migrations live in `supabase/migrations/`
and apply cleanly to either with `supabase db push`.

---

## 2. Environment variables

Copy `.env.local.example` and fill it in. Set the same vars in **Vercel → Project →
Settings → Environment Variables** (Production + Preview).

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Secret.** Server-only admin client |
| `ANTHROPIC_API_KEY` | ✅ | **Secret.** Server-only |
| `NEXT_PUBLIC_APP_URL` | ✅ | e.g. `https://orbitapi.vercel.app` (Stripe redirects, emails) |
| `CRON_SECRET` | ✅ | Long random string; Vercel Cron sends it as `Authorization: Bearer …` |
| `SIGNUP_INVITE_CODE` | ✅ for beta | When set, signup requires this code. Leave empty for open signup |
| `STRIPE_SECRET_KEY` | for billing | Unset → billing disabled gracefully |
| `STRIPE_WEBHOOK_SECRET` | for billing | From the Stripe webhook endpoint |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_PRO_PRICE_ID` | for billing | Recurring price IDs |

Inbound webhook endpoints each get their own HMAC secret stored per-endpoint in the DB —
there is no global webhook secret.

---

## 3. Database

```bash
supabase link --project-ref <your-prod-ref>
supabase db push        # applies all migrations, incl. 033 (entitlements/limits)
```

Migration `033_entitlements_and_limits.sql` resets `feature_flags` to override semantics
(empty = plan defaults), adds `ai_credit_override`, and the `rate_limits` table + limiter RPC.

---

## 4. Cron jobs

`vercel.json` registers two crons (both need a paid Vercel plan for sub-daily schedules;
on Hobby, change schedules to daily):

- `/api/cron/skills` — hourly (scheduled skills)
- `/api/cron/playbooks` — hourly (autonomous playbooks)

Both are protected by `CRON_SECRET`.

---

## 5. Pre-launch guardrails (set before external testers)

- **Signup gating** — set `SIGNUP_INVITE_CODE` so it's a closed beta. (Optionally also
  disable public signups in Supabase Auth settings for defense in depth.)
- **AI spend cap** — enforced automatically: each workspace has an AI Power credit
  allowance (Free = 3,000 credits ≈ $3/mo). Out-of-power requests return HTTP 402.
- **Rate limiting** — `/api/chat` and the skill/playbook run endpoints are throttled
  per user (DB-backed, fails open). Tune limits in the route handlers.
- **Use Simulated connectors** — point testers at "Simulated Lights" so no real
  credential is needed and nothing real is touched during testing.

---

## 6. Plans, gating & billing

- Tier → capability mapping lives in `lib/entitlements.ts`. Free is limited to the
  Assistant + connectors; builder surfaces unlock on Starter/Pro.
- Credit allowances per tier live in `lib/ai-power.ts` (`TIER_MONTHLY_CREDITS`).
- **Manual overrides** (Super Admin → Workspaces → a workspace): set the **tier**,
  flip individual **capabilities** (Default/On/Off), and set an **AI credit override**
  for comped testers or custom/enterprise deals.
- **Promo/discount codes:** Stripe Checkout already shows an "Add promotion code" box
  (`allow_promotion_codes: true`). Create coupons + promotion codes in the Stripe
  dashboard; they apply to Starter/Pro checkout automatically.

---

## 7. IP exposure posture

The goal is to expose enough to be useful without handing over the "recipes."

- Free tier cannot reach the builder surfaces (Skills, Playbooks, Data Mapping,
  Bundles, Discover, API Reference) — they show an Unlock screen.
- Marketplace browse (`GET /api/marketplace`) returns listing metadata only — the full
  bundle **manifest** (playbook/skill definitions) is never sent to the browser.
- Credentials are stored encrypted and never sent to the AI model.
- System prompts / playbook node definitions stay server-side; a workspace only ever
  sees its own resources.

---

## 8. Go-live steps

1. Push to GitHub; import the repo in Vercel.
2. Add env vars (Production + Preview).
3. `supabase db push` against prod.
4. Set up the Stripe webhook → `https://<app>/api/billing/webhook` (if billing on).
5. Set `SIGNUP_INVITE_CODE` and share it with invited testers.
6. Smoke test: sign up → connect Simulated Lights → ask the Assistant → confirm an action.

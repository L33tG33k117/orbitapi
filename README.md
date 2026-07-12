# OrbitAPI

Dummy-proof APIs for the masses. Connect your apps (real or simulated), then let an AI assistant, Skills (scheduled automations), and Playbooks (multi-step flows) act across them — all in plain English.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Supabase (Postgres + Auth + Vault) · Anthropic Claude (via the AI SDK) · Tailwind CSS 4 · deployed on Vercel.

> ⚠️ **This repo is public.** Never commit real keys or secrets. All secrets live in `.env.local` (gitignored) locally and in Vercel project settings in production. If a key ever lands in a commit, rotate it immediately.

---

## Local development

### 1. Prerequisites

- **Node.js 24+** and npm (CI runs on Node 24)
- A **Supabase** project (free tier works) — [supabase.com](https://supabase.com)
- An **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)

### 2. Install

```bash
git clone https://github.com/L33tG33k117/orbitapi.git
cd orbitapi
npm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` (see the [key reference](#environment-variables--api-keys) below). The minimum for a working dev setup is the three Supabase values and `ANTHROPIC_API_KEY`. Leave `SIGNUP_INVITE_CODE` empty locally so you can sign up freely.

### 4. Set up the database

Migrations live in `supabase/migrations/` (numbered, run in order). Two ways to apply them:

- **Automatic (recommended):** create a personal access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), put it in `SUPABASE_ACCESS_TOKEN` in `.env.local`, then:

  ```bash
  npm run db:status   # see which migrations are pending
  npm run db:up       # apply all pending migrations
  ```

- **Manual:** paste each file from `supabase/migrations/` into the Supabase dashboard → SQL Editor, in numeric order.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and follow the setup wizard. Every connector works instantly in **Simulated mode** with zero API keys, so you can exercise the whole product without connecting anything real.

### 6. Quality checks (what CI runs)

```bash
npx tsc --noEmit          # type check
npm run check:connectors  # connector catalog integrity
npm run check:bundles     # bundle registry integrity
npm run test:sim-parity   # every action has simulation data
npm run build             # production build
```

CI (`.github/workflows/ci.yml`) runs all of these on every push and PR — keep them green before pushing.

---

## Environment variables & API keys

Set these in `.env.local` for development and in **Vercel → Project → Settings → Environment Variables** for production. Values below are placeholders — get your own from each provider.

| Variable | Required | Where to get it / notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase dashboard → Project Settings → API. Your project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same page. Public (client-safe) key; RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Same page. **Server-only, bypasses RLS — keep secret.** |
| `ANTHROPIC_API_KEY` | ✅ | [console.anthropic.com](https://console.anthropic.com) → API Keys. Powers the assistant, skills, playbooks, and the simulation engine. Server-only. |
| `NEXT_PUBLIC_APP_URL` | ✅ prod | Public base URL of the deployment (e.g. `https://your-app.vercel.app`). Used for Stripe redirects, webhooks, and emails. `http://localhost:3000` in dev. |
| `CRON_SECRET` | ✅ prod | Any long random string. Vercel Cron sends it as `Authorization: Bearer …` to the cron endpoints; requests without it are rejected. |
| `SIGNUP_INVITE_CODE` | prod | Closed-beta gate — signups must supply this exact code. Leave empty for open signup (dev only). |
| `SUPABASE_ACCESS_TOKEN` | optional | Personal access token for `npm run db:up` (Management API). Account-scoped — keep it out of Vercel; it's only needed where you run migrations from. |
| `STRIPE_SECRET_KEY` | optional | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys. Leave unset to disable billing (upgrade buttons show "not configured"). |
| `STRIPE_WEBHOOK_SECRET` | optional | Stripe → Developers → Webhooks, after adding the endpoint (step 5 below). |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_PRO_PRICE_ID` | optional | IDs of the two subscription Prices you create in Stripe Products. |
| `RESEND_API_KEY` | optional | [resend.com](https://resend.com) → API Keys. Enables emailed skill-run summaries; the in-app bell works without it. |
| `EMAIL_FROM` | optional | From-address for Resend emails, e.g. `OrbitAPI <notifications@yourdomain.com>` (domain must be verified in Resend). |

Per-connector API keys (Slack bot tokens, GitHub PATs, Stripe keys for the *connector*, etc.) are **not** env vars — users paste them in the app when connecting, and they're stored encrypted in Supabase Vault.

---

## Production deployment (Vercel)

The production app auto-deploys from this repo: **every push to `main` deploys to production.** There is no staging environment — verify locally (`npm run build`) before you push.

### 1. One-time project setup

1. [vercel.com/new](https://vercel.com/new) → import this GitHub repo. Framework preset: **Next.js** (defaults are fine; `vercel.json` is picked up automatically).
2. In **Settings → Environment Variables**, add every required variable from the table above with production values. Set `NEXT_PUBLIC_APP_URL` to the deployment URL Vercel gives you (update it if you attach a custom domain).
3. Generate a strong random `CRON_SECRET` and set `SIGNUP_INVITE_CODE` to keep the beta invite-gated.

### 2. Database (Supabase)

Production uses a Supabase project — apply all migrations to it before first deploy and whenever a new migration lands:

```bash
npm run db:up
```

(with `.env.local` pointed at the production Supabase project). Migrations are additive and numbered; never edit an applied migration — add a new one.

### 3. Cron jobs

`vercel.json` registers two crons — `/api/cron/skills` (daily 13:00 UTC) and `/api/cron/playbooks` (daily 14:00 UTC). Vercel calls them automatically with `CRON_SECRET`. Note: the Hobby plan runs crons **once per day at most**, so scheduled skills fire daily regardless of their configured hour; upgrade the Vercel plan for finer schedules.

### 4. Deploy

```bash
git push origin main
```

That's it. CI runs the quality gates on the push; Vercel builds and promotes automatically. Then verify: open the production URL, log in, and run one skill from Starlab.

### 5. Optional: Stripe billing

1. Create two recurring **Products/Prices** in Stripe (Starter, Pro); copy their price IDs into the env vars.
2. Add a webhook endpoint in Stripe → Developers → Webhooks pointing at `https://<your-domain>/api/billing/webhook` (subscription + checkout events); copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Redeploy. Without these vars the app runs fine — billing UI just shows "not configured" and plans are granted manually via the admin panel.

### 6. Optional: Email (Resend)

Set `RESEND_API_KEY` + `EMAIL_FROM` (verified domain) and redeploy — skill-run summary emails switch on.

---

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:status` / `db:up` | Show / apply pending Supabase migrations |
| `npm run check:connectors` | Connector catalog integrity (dups, manifests, actions) |
| `npm run check:bundles` | Bundle registry integrity |
| `npm run test:sim-parity` | Every connector action has simulation coverage |
| `node scripts/read-feedback.mjs [new\|all]` | Read the beta feedback board (needs service-role key) |
| `node scripts/mark-feedback.mjs <status> <id…>` | Update feedback statuses |

## Repo map

```
app/              Next.js App Router — pages + API routes
  (dashboard)/    Authenticated product UI
  api/            REST endpoints (chat, execute, skills, cron, MCP, webhooks…)
components/       Shared React components
connectors/       Connector manifests (hand-written + rest/ factory specs) + catalog
lib/              Server logic (runners, access control, sim engine, audit…)
supabase/
  migrations/     Numbered SQL migrations — the schema's source of truth
scripts/          CI checks, DB migrator, ops helpers
```

# Deployment Hardening (Beta Launch)

**Status:** Complete (live, migration 033 applied).

## Summary
Pre-launch guardrails so OrbitAPI can be hosted for external testers safely, plus the
Vercel + Supabase deployment guide. See `docs/DEPLOYMENT.md` for the step-by-step checklist.

## What was added
- **Playbooks cron** registered in `vercel.json` (`/api/cron/playbooks`, hourly) — previously
  only the skills cron was scheduled, so autonomous playbooks never fired in prod.
- **Complete `.env.local.example`** — Stripe vars, `NEXT_PUBLIC_APP_URL`, `SIGNUP_INVITE_CODE`,
  `CRON_SECRET`, plus a note that webhook signing secrets are per-endpoint (in DB).
- **Signup gating (closed beta):** `SIGNUP_INVITE_CODE`. Server route `/api/auth/signup`
  enforces the code before creating the account; `/api/auth/signup-config` tells the form
  whether to show the invite field. Unset = open signup (dev).
- **Rate limiting:** DB-backed fixed-window limiter (`lib/rate-limit.ts` →
  `check_rate_limit` RPC, table `rate_limits`). Fails open. Applied to `/api/chat` (30/min),
  skill run + playbook run (20/min) per user. Spend is separately capped by AI Power credits.

## Key files
- `vercel.json`, `.env.local.example`, `docs/DEPLOYMENT.md`
- `app/api/auth/signup/route.ts`, `app/api/auth/signup-config/route.ts`, `app/(auth)/signup/page.tsx`
- `lib/rate-limit.ts`, migration `033_entitlements_and_limits.sql`

## Gotchas
- The invite gate is enforced server-side, but the Supabase anon key can still call
  `auth.signUp` directly — for a hard lock, also disable public signups in Supabase Auth.
- Vercel Hobby plan only allows daily crons; sub-daily schedules need a paid plan.

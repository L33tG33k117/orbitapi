# Tier Gating & Entitlements

**Status:** Complete (live, migration 033 applied).

## Summary
Per-plan feature gating. Each plan **tier** (free/starter/pro/enterprise) grants a set of
**capabilities**; a per-workspace override layer can grant/revoke any capability. Free is
deliberately limited (Assistant + connectors) — the builder surfaces are paid, which is both
the upgrade lever and the IP safeguard. Locked features stay visible but show an Unlock screen.

## How it works
- **Source of truth: `lib/entitlements.ts`** (pure, importable client + server).
  - `Capability` union + `TIER_CAPABILITIES` (what each tier grants by default).
  - `hasCapability(tier, overrides, cap)` → `override ?? tierDefault`.
  - `requiredTierFor(cap)` → lowest tier that grants it (for "Available on Pro" copy).
  - `CAPABILITY_INFO` → user-facing label/description (no model/vendor names).
- **Overrides:** `workspaces.feature_flags` (jsonb) is now an override map —
  `{ webhooks: true }` grants, `{ webhooks: false }` revokes, absent = tier default.
  Empty `{}` = pure tier defaults. (Migration 033 reset legacy all-true rows.)
- **Free tier capabilities:** `ai_chat`, `connectors`, `groups`, `skills` (capped — see below).
  Paid adds `skill_automation`, `bundles`, `data_mapping` (starter) then `playbooks`, `webhooks`,
  `discover`, `api_reference`, `advanced_connectors`, `bundle_export` (pro/enterprise).
- **Free "taste of automation":** Free can create & **manually run 1 Skill** (`FREE_SKILL_LIMIT`,
  `skillLimit(tier)`), but NOT schedule it or use Supervised/Autonomous modes — that's the
  `skill_automation` capability (paid). Enforced in `/api/skills` POST (count cap + forces
  `autonomy:'manual'`) and `/api/skills/[id]` PUT (strips schedule/non-manual for free), and the
  skill editor greys Supervised/Autonomous with an upgrade nudge.
- **Connector limit:** Free = **3 real connectors** (`FREE_CONNECTOR_LIMIT`, `connectorLimit(tier)`);
  paid = unlimited. Simulated/demo connections are exempt and always allowed. Enforced in
  `/api/connections` POST (counts non-simulated, non-trashed). Catalog only shows "Upgrade for more
  connectors" on **available** real connectors when at the limit — coming-soon connectors always show
  "Coming soon" (never an upsell). The old blanket `advanced_connectors` catalog lock was removed.
- **Save chat as skill:** the Orbit Assistant shows "Save as reusable skill" after an exchange; it
  builds a persona from the user's messages and POSTs to `/api/skills` (so the cap + manual rules
  apply), then opens the editor. Out-of-cap → toast with Upgrade action.

## Enforcement (defense in depth)
- **Sidebar** (`components/sidebar.tsx`): nav items carry an optional `capability`; locked
  ones render greyed with a lock icon but remain clickable.
- **Pages** (`components/page-gate.tsx` → `pageGate(cap)`): gated server pages early-return
  `<FeatureGate>` (Unlock → `/upgrade`) before fetching data. Applied to skills, playbooks,
  data-mapping, bundles, webhooks, discover, reference, chat.
- **APIs** (`lib/workspace-features.ts` → `capabilityGuard(cap)`): returns 403 `plan_required`.
  Applied to create/run/install/export routes (skills, playbooks, webhooks, bundles, marketplace).

## Admin controls (Super Admin → Workspaces → [id])
- Set **tier**, flip each **capability** (Default / On / Off), set an **AI credit override**.
- Backed by `GET/PATCH /api/admin/workspaces/[id]` (now also reads/writes `ai_credit_override`).
- Manual free→pro conversion = just set the tier. Comp a tester = set a credit override.

## Credits
- `lib/ai-power.ts`: paid `TIER_MONTHLY_CREDITS` (starter 15k / pro 60k / enterprise 1M) reset monthly.
- **Free = one-time `FREE_TRIAL_CREDITS` (default 500) that never refills** — free is never a recurring AI cost.
  `getAiPower()` returns `isTrial` for free and honors `workspaces.ai_credit_override` when set. See ai-power.md.

## Billing / promo codes
- Stripe Checkout has `allow_promotion_codes: true` — create coupons + promotion codes in
  Stripe; they apply to Starter/Pro checkout automatically.

## Key files
- `lib/entitlements.ts`, `components/page-gate.tsx`, `components/feature-gate.tsx`,
  `lib/workspace-features.ts` (`checkCapability`, `capabilityGuard`), `components/sidebar.tsx`,
  `app/admin/workspaces/[id]/page.tsx`, `app/api/admin/workspaces/[id]/route.ts`,
  migration `033_entitlements_and_limits.sql`.

## Gotchas
- `feature_flags` semantics changed from "all features on" to "overrides". Consumers must use
  `hasCapability(...)`, never read `flags.x` directly (a missing key is no longer "true").
- `lib/ai-power.ts` imports the server admin client — never import it into a client component;
  use `lib/entitlements.ts` (pure) on the client instead.

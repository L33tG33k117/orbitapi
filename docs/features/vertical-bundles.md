# #7 — Vertical Bundles (Security SOC / Support Ops / Property Mgmt)

**Status:** Complete (live). Rides on Foundation C.

## Summary
Runnable-out-of-the-box solution packs installed in one click: API connectors + a group + pre-built
playbooks (with severity autonomy) + skills + personas. Security SOC is the spearhead.

## How it works
- Bundles are code-defined `BundleManifest`s in `lib/bundle-registry.ts` (`BUILTIN_BUNDLES`).
- The Bundles page enriches each manifest (connector slugs → real names) and renders expandable cards
  ("See what's inside" → connectors, playbooks, skills). Admins click Install.
- Install/uninstall use the Foundation C primitive (`installBundle`).

## The three bundles
- **Security SOC** — CrowdStrike, SentinelOne, MS Defender, PagerDuty, Slack. Playbooks: "Critical
  Detection Response" (assess→contain_host severity-gated→notify), "Endpoint Isolation (approval chain)".
  Skill: "SOC Analyst".
- **Support Ops** — Zendesk, Plain, SendGrid, Slack. Playbook: "SLA Breach Watch". Skill: "Support Triage".
- **Property Management** — Lodgify, Twilio, SendGrid, Slack. Playbook: "Daily Arrivals Briefing".
  Skill: "Check-in Concierge".

## Key files
- `lib/bundle-registry.ts` — the manifests (real action slugs e.g. `contain_host`, `isolate_agent`)
- `app/(dashboard)/bundles/page.tsx`, `bundle-card.tsx` (expandable), `install-button.tsx`
- `app/api/bundles/install/route.ts`

## Gotchas
- Action steps use `connector_slug` → remapped to connection ids at install.
- Connectors install without credentials; live action steps need creds added before they fire.

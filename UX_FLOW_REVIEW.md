# UX / Flow Review — 2026-07-02

Full pass over every dashboard tab during the UI revamp, with the "dummy-proof APIs for the
masses" lens. Smoke test: all 34 routes return 200 in a production build; auth-gated pages
redirect to login correctly; two clean type-checked builds.

## Fixed in this pass

- `/automations` was a stale "Coming in Phase 4" placeholder (predates Skills/Playbooks).
  Now redirects to `/skills`, matching the `/costs` → `/ai-power` pattern.
- Webhooks page copy de-jargonized ("HMAC-signed inbound endpoints" → plain language;
  the technical detail stays in the body UI).
- Discover page copy de-jargonized ("OpenAPI spec introspection" → "name any app or paste
  its API documentation link").
- Every tab now opens with a consistent header (PageHero on destinations, PageHeader with
  section eyebrow on interior pages), so users always know which section they're in.

## Findings to consider (not yet changed — product decisions)

1. ~~**Three overlapping "what happened" tabs.**~~ **Fixed 2026-07-02:** Activity, Usage,
   and Audit Log now share an `InsightsTabs` view-switcher under each hero, so they read as
   three views of one section rather than three competing tabs.

2. ~~**Groups is a concept-tax on the first skill.**~~ **Correction (2026-07-02):** wrong on
   closer reading — the skill form already defaults to "All my connections" and a group is
   optional (`skills.group_id` nullable; runner treats no group as all connections). No
   change needed; Groups is already an optional power feature.

3. ~~**Two different "3-step start" narratives.**~~ **Fixed 2026-07-02:** the Guide
   quick-start now tells the wizard's story — connect (simulated ok) → create a skill → run.

4. ~~**"Admins only" dead ends.**~~ **Fixed 2026-07-02:** AI Power, Webhooks, and Discover
   now render a shared `AdminsOnly` notice for members — keeps the page header, explains in
   plain words what the page does, and lists the workspace admins (name + mailto) to ask.

5. ~~**Webhooks setup is still technical past the header.**~~ **Fixed:** recipes shipped
   2026-07-02 (Stripe / GitHub / Typeform / Shopify / Calendly / Mailchimp chips that pre-fill
   the form), and a plain-language "New to webhooks? Start here" primer shipped 2026-08-02 for
   the rung below that — what a webhook actually *is*.

6. **Naming consistency win to keep:** sidebar label, page title, and eyebrow now match on
   every tab (e.g. "Groups", not "Connection Groups"). Keep this rule for new pages.

## 2026-07-02 usability pass (from founder walkthrough)

Shipped: connector row actions now read as buttons (icons + fill, stronger outline style
globally); "Manual" renamed **"Use now"** and promoted as the primary action; Widget Wizard
moved below Available actions (power feature, not the front door); Available actions grouped
by topic (Bookings, Guests, …) with collapsible sections when >12 actions; connector detail
page opens with a 3-card "Use it now / Ask in plain English / See past answers" section;
Lodgify guest-messages action rewritten to endpoints that actually exist (old one always
errored on real accounts); run-history error steps now show the actual error + a "how to fix
it" panel; test-run explainer line; bundle install ends with a "what you got & where it
lives" screen instead of a toast.

Open ideas from the same walkthrough: badge skills/playbooks with the bundle they came from;
a "Run" button directly on installed bundle cards (runs its first skill); webhook recipes
(finding 5).

## Strong dummy-proofing already in place (keep)

- Approvals risk legend (read/write/destructive in plain words).
- Locked-feature tooltips that explain what the feature *does*, not just "upgrade".
- SectionIntro explainers on each major page.
- Simulated connectors + "no API keys needed" paths everywhere.
- Get Started checklist driven by real workspace state.

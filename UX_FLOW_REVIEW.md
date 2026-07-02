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

1. **Three overlapping "what happened" tabs.** Activity, Audit Log, and Usage all answer
   "what did the system do." Activity is the friendly feed, Audit is the compliance table,
   Usage is charts. Recommendation: keep all three but make Activity the default Insights
   landing and cross-link the other two from it; longer-term consider folding Audit into an
   "Advanced" toggle on Activity. Non-technical users should never need to choose.

2. **Groups is a concept-tax on the first skill.** Skills require picking a Group, so a new
   user must learn Groups before their first automation. Recommendation: auto-create a
   default "Everything" group per workspace (all connections), pre-selected in the skill
   form. Groups then becomes an optional power feature, not a prerequisite.

3. **Two different "3-step start" narratives.** The Guide says connect → install a bundle →
   run; the Welcome wizard says connect demo → create skill → run. Pick one canonical story
   (suggest the wizard's) and align the Guide.

4. **"Admins only" dead ends.** AI Power, Webhooks, and Discover show a bare "Admins only."
   for members. Friendlier: explain what the page does + "ask your workspace admin
   (name/email) for access."

5. **Webhooks setup is still technical past the header.** Consider preset "recipes"
   (Stripe payment received, GitHub issue opened, Typeform response) that pre-fill the
   endpoint config, rather than starting from a blank signed endpoint.

6. **Naming consistency win to keep:** sidebar label, page title, and eyebrow now match on
   every tab (e.g. "Groups", not "Connection Groups"). Keep this rule for new pages.

## Strong dummy-proofing already in place (keep)

- Approvals risk legend (read/write/destructive in plain words).
- Locked-feature tooltips that explain what the feature *does*, not just "upgrade".
- SectionIntro explainers on each major page.
- Simulated connectors + "no API keys needed" paths everywhere.
- Get Started checklist driven by real workspace state.

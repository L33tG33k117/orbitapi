# OrbitAPI — Improvement Suggestions

Compiled after completing Phases 5–7. Grouped by theme; items marked **[Quick]** are low-effort, **[High impact]** are strategic.

---

## 1. Onboarding & First-Run Experience

- **[High impact] Guided setup wizard** — New workspaces currently land on a blank dashboard. A 3-step flow (connect your first tool → create your first skill → run it once) would cut time-to-value dramatically.
- **[Quick] Empty-state illustrations** — The Skills, Connectors, and Chat pages show plain text when empty. Replace with contextual empty states that include a single CTA (e.g. "Create your first skill →").
- **[Quick] Sample skills library** — Ship 5–10 pre-built skill templates (nightly Airbnb check-in review, Slack digest, CRM sync audit) that users can clone into their workspace with one click.
- **Workspace invite flow** — Currently members must be added manually. Add an invite-by-email flow that sends a Supabase magic-link with the workspace pre-attached.

---

## 2. Skills & Automation Engine

- **[High impact] Skill run notifications** — When a skill completes (especially autonomous), send a summary to the user via email or an in-app notification bell. Users currently have no idea a run happened unless they check the history manually.
- **[High impact] Run diff view** — For supervised mode, show a side-by-side "what the AI would have done" diff so users can approve or reject proposed writes before promoting the skill to live.
- **Skill templates / variables** — Let a skill reference `{{workspace.name}}` or `{{user.email}}` so one template works across multiple workspaces without copy-pasting persona text.
- **[Quick] Skill enabled/disabled toggle on the list page** — Users must open each skill to toggle it. Add an inline toggle to the skills list table.
- **Run log search & filter** — The run history panel is chronological only. Add status filter (success / error / skipped) and date range picker.
- **Skill chaining** — Allow the output of one skill to trigger another (e.g. "after booking-check runs, fire the welcome-message skill"). Currently there is no way to compose skills.
- **Retry on failure** — Skills that error due to a transient API issue have no retry logic. Add configurable retry (e.g. 3 attempts, 5-minute backoff).

---

## 3. Connector Catalog & Connections

- **[High impact] OAuth connectors** — All current real connectors use API keys. Adding OAuth (Google, Slack, Salesforce) would remove the friction of users finding and copy-pasting credentials.
- **[Quick] Connection health badges** — Show a green / red dot on each connection card indicating last successful ping. Right now a broken connection is invisible until a skill fails.
- **Credential rotation reminders** — Detect when an API key hasn't been rotated in 90 days and surface a warning in the UI.
- **Multi-account per connector** — Some users need two Slack workspaces or two AWS accounts. Currently one connector type = one connection. Allow multiple connections of the same type in a group.
- **[Quick] Connector request status emails** — When an admin approves or rejects a connector request, send an automated email to the requester. Currently there is no notification.
- **Simulated → real connector graduation** — Document (or automate) the path from a demo/simulated connector to a real implementation. This makes the roadmap feel tangible to users.

---

## 4. AI Chat

- **[High impact] Chat history persistence** — Conversations are stored in the `conversations` table but the UI shows no history sidebar. Add a left panel showing past conversations so users can resume where they left off.
- **Cited sources in responses** — When the AI reads data from a connector, show a collapsible "Sources used" section in the chat message (e.g. "Retrieved 3 bookings from Lodgify").
- **[Quick] Suggested prompts** — On an empty chat, show 4–6 contextual quick-prompts based on the user's connected tools (e.g. "Summarize today's bookings").
- **File/image upload** — Let users drop a CSV or screenshot into chat for the AI to analyze alongside live connector data.
- **Chat-to-skill** — Add a "Save this as a skill" button after a successful chat interaction so the prompt + persona gets persisted as a recurring automation.

---

## 5. Admin Panel

- **[High impact] Usage metrics per workspace** — Show skill run counts, API call volumes, and token usage per workspace so you can enforce tier limits and identify heavy users.
- **Billing integration** — Wire the `tier` field to a real payment processor (Stripe). Right now tier upgrades are manual admin operations, which doesn't scale.
- **Audit log** — A time-ordered log of admin actions (tier changes, feature flag overrides, user super_admin grants) for compliance and debugging.
- **[Quick] Bulk workspace tier change** — The workspaces table currently requires editing one workspace at a time. Add a checkbox + bulk-action dropdown.
- **Connector request dashboard metrics** — Show pending request count as a badge on the "Requests" nav item so admins don't miss queue buildup.

---

## 6. Security & Compliance

- **[High impact] Row-level encryption for credentials** — API keys stored in the `connections` table are currently protected only by RLS. Consider encrypting at rest with a per-workspace key (Supabase Vault or similar).
- **Session management** — Show active sessions in Settings and let users revoke individual sessions (useful for shared computers).
- **[Quick] 2FA enforcement per workspace** — Let workspace admins require two-factor authentication for all members.
- **Webhook signature verification** — Inbound webhooks to `/api/webhooks/skills/:id` verify the secret in the URL. Move the secret to a header (`X-Orbit-Signature: HMAC-SHA256`) to avoid leaking it in server logs.
- **Rate limiting** — The API routes have no rate limiting. A single misbehaving client (or an automated attack) can exhaust Supabase connection pool. Add rate limiting at the edge (Next.js middleware or Vercel WAF).
- **Principle of least privilege on admin client** — `createAdminClient()` (service role key) is used broadly. Scope it only to the routes that truly need it; use the user's session token elsewhere.

---

## 7. Developer Experience

- **[Quick] Type-safe Supabase queries** — The codebase uses `as unknown as X` casts in several places. Run `supabase gen types typescript` as a CI step and replace manual types with generated ones.
- **API documentation** — Document the internal REST API (`/api/skills`, `/api/connections`, etc.) so team members can build integrations without reading source.
- **End-to-end tests** — There are no automated tests. Even a small Playwright suite covering sign-in → connect a demo connector → create a skill → run it would catch regressions before they reach prod.
- **Error tracking** — Integrate Sentry (or similar) so uncaught exceptions in API routes and client components surface with stack traces, rather than silent failures.
- **Preview deployments** — Set up Vercel preview URLs per PR so changes can be reviewed in a running environment before merge.

---

## 8. UX Polish

- **[Quick] Global keyboard shortcuts** — `Cmd+K` command palette for navigating to any page, skill, or connection. High value for power users.
- **[Quick] Breadcrumbs on deep pages** — Skill detail and workspace detail pages have no breadcrumb. Users must use the back button.
- **Mobile-responsive layout** — The sidebar and data tables are not usable on mobile screens. A bottom-nav layout for mobile would unlock mobile monitoring use cases.
- **Toast notifications** — Save/delete actions currently show inline success text. Consistent toast notifications (top-right) across all pages would feel more polished.
- **Dark mode system sync** — Dark mode is implemented but defaults to `system`. Verify it looks correct in both themes, especially chart colors and connector logo backgrounds.

---

## 9. Business / Growth

- **[High impact] Public connector marketplace** — Let third-party developers submit connectors via a JSON manifest. This is how Zapier scaled its integration library without building everything in-house.
- **Usage-based pricing add-on** — Consider a "pay per skill run" add-on above the Pro tier for high-volume users rather than hard limits.
- **Workspace analytics for users** — A simple dashboard showing "your skills ran X times this week, saved ~Y hours" gives users a concrete ROI number they can share with their team or manager.
- **SSO / SAML** — Enterprise buyers expect SSO. This would be the primary unlock for moving upmarket beyond the Pro tier.
- **White-label option** — Some agency customers would pay to remove OrbitAPI branding. A white-label tier could be a significant revenue stream.

---

*Items are suggestions only — prioritize based on actual user feedback and usage data.*

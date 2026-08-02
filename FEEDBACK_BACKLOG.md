# OrbitAPI — Beta Feedback Backlog

Compiled 2026-06-21 from in-app beta feedback (admin → Feedback). This captures
the **bigger items** that need a product decision or a sizeable build. Bugs,
already-shipped items, and quick wins were handled directly (see below).

---

## Already shipped (status flipped to *actioned*)
Rename API Reference → Connector Actions · autonomy Severity → Confidence ·
connector-request spacing · g-then-letter hotkeys · `conversations.updated_at`
500 · out-of-AI-Power message · empty chat history · connector action-type filter.

## Bugs fixed this pass
- **Chat history saved nothing** — `conversation_messages` table was never created
  (migration 014 collided with the 001 `conversations` table and aborted). Created
  it in migration 042; messages now persist. *(root-cause fix)*
- **Playbook webhook URL/key not findable** — added a callout in the playbook editor
  linking to the Webhooks page.
- **Data Mapping "where do I save rules?"** — added a "how to use this" note (it
  proposes + previews; reusable saved rules are a roadmap item, see below).
- **Simulated widget "Connection not found"** — not reproducible; the lookups already
  support simulated connections and the referenced connection had been deleted.

## Quick wins shipped this pass
Skill-mode descriptions clarified (Supervised previews, Autonomous acts) · Verify
button explained · connector Available-actions search box · chat "Context" picker
tooltip · webhook usage examples (cURL/PowerShell/Python) · sidebar shortcut hint.

---

## Bigger items to scope

> **Status update 2026-07-02:** every item below has **shipped** — kept here
> (struck through) for the record. Only the "other notable single mentions" at
> the bottom remain open.

### ~~1. Per-connector access controls (RBAC)~~ — ✅ SHIPPED 2026-06-21
**Ask:** Enable/disable **Read / Write / Destructive** actions per connector
("API Connector Controls" with checkboxes), and a "mark connector read-only" toggle.
**Current state:** We have an action-type *filter* (view only) and per-member
read/read_write grants, but no per-connector cap on action classes.
**Recommended approach:** Add `allowed_risk_levels` (e.g. `['read','write']`) to the
`connections` row; enforce in `/api/execute`, the chat tool builder, and the skill/
playbook runners (skip/deny actions whose `risk` isn't allowed). UI: checkboxes on
the connector detail page.
**Effort:** Medium (1 migration + enforcement in ~4 call sites + UI).
**Shipped as:** migration 043 `allowed_risk_levels` on connections; enforced in
`/api/execute`, chat tool builder, skill runner, playbook runner, and MCP
(`lib/connector-access.ts`); checkboxes on the connector detail page.

### ~~2. User-facing feedback tracker~~ — ✅ SHIPPED 2026-06-21
**Ask:** Let users see the feedback they submitted, with a status (Under
consideration / In development / Implemented + release date).
**Current state:** `feedback.status` exists (new/acknowledged/actioned) but is
admin-only; no user view.
**Recommended approach:** Map internal statuses → friendly labels (Received →
Reviewing → Done), add `GET /api/feedback/mine`, and a "My feedback" list on the
Help/Guide page (or a small panel in the feedback widget). Optional `released_at`
column for the "Implemented on" date.
**Effort:** Small–Medium.
**Shipped as:** "My feedback" tab in the feedback widget (`feedback-button.tsx`)
with Received / Reviewing / Done labels, backed by `GET /api/feedback`.

### ~~3. Drag-and-drop Playbook builder~~ — ✅ SHIPPED 2026-06-21 (canvas view, now the default)
**Ask:** A visual node/arrow editor for playbooks (drag steps, connect them).
**Current state (verified):** `playbook-detail.tsx` edits an **ordered list** of
step nodes (add, move up/down, remove); condition nodes branch by referencing
other step IDs for true/false. **No flow/graph library is installed.**
**Recommended approach (phased):**
1. Add **`@xyflow/react`** (React Flow) — needs sign-off since it's a sizeable UI dep.
2. Model: keep `definition.steps` as the source of truth. Map each step → a node;
   derive edges from `next` (and condition true/false targets). Add an optional
   `position {x,y}` per node so layout persists (auto-layout with dagre on first open).
3. Canvas: custom node types per step kind (assess/action/condition/approval/notify/wait),
   draggable, with a side panel for the selected node's config (reuse today's fields).
   Edges = connections; deleting/redrawing an edge rewrites `next`.
4. Keep the current list editor as a fallback/toggle until the canvas is solid.
**Effort:** Large (new dep + canvas UX + serialization + testing). **Best as a
dedicated, supervised build** — not a rushed unsupervised push. High wow-factor.
**Why not built in this pass:** it needs a dependency decision and design choices
worth doing with you in the loop; everything else in this list shipped.

### ~~4. Connection-deletion behavior: per-user vs workspace setting~~ — ✅ SHIPPED 2026-06-21
**Ask:** A tester felt "delete vs trash" is a platform/admin policy, not a personal
preference (an admin may want to *prevent* users changing it).
**Current state:** It's a per-user profile preference (`connection_delete_preference`).
**Recommended approach (decision needed):** Add a workspace-level default + an
"allow members to override" flag; fall back to per-user only when allowed. Small
build once the policy is decided.
**Effort:** Small, but **needs a product call first.**
**Shipped as:** migration 044 — workspace default + "allow members to override"
lock, falling back to the per-user preference only when allowed.

---

## Other notable single mentions

> **Status update 2026-08-02:** all three shipped.

- ~~Restrict Orbit Assistant to Orbit-only topics (system-prompt scope).~~ ✅ **SHIPPED 2026-08-02** —
  `SCOPE_SYSTEM_RULES` in `lib/prompt-safety.ts`, applied in the chat route to the default
  assistant only. Skills keep their own persona and remit, so the skill runner doesn't use it.
  Deliberately permissive about *content that came out of a connected app* — analysing a
  customer's email is in scope even though the subject matter is general.
- ~~"Connector Actions" page purpose unclear / feels redundant with per-connector view.~~
  ✅ **DECIDED + SHIPPED 2026-08-02: keep and explain.** It isn't redundant — it's the only
  cross-connector search ("which of my apps can do X?"). The page never said so. Hero, intro
  callout, sidebar tooltip, entitlement blurb and tour now all lead with that, and the callout
  links one-app users back to Connectors for the guided "Use now" form.
- ~~Webhooks page: short "what is a webhook" primer.~~ ✅ **SHIPPED 2026-08-02** — collapsible
  "New to webhooks? Start here" panel (`WebhookPrimer` in `webhooks-client.tsx`): private-phone-number
  analogy, 3-step how-it-works, and a plain-language "is it safe?" note. Open by default, remembered
  per browser once dismissed. The `SectionIntro` copy was de-jargoned to match.

## New this pass (2026-08-02)
- **Cursor is an arrow on everything clickable** (beta feedback, `/webhooks`, Mac/Chrome).
  Root cause was Tailwind v4's preflight dropping v3's `cursor: pointer` on buttons — fixed
  globally in `app/globals.css` rather than per-component. Also covers `[role=button]`, tabs,
  switches, menu items, `<summary>`, `<label for>`, and file/range/colour inputs; disabled
  controls get `not-allowed`.

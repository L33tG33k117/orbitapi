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

### 1. Per-connector access controls (RBAC) — *raised twice, high signal*
**Ask:** Enable/disable **Read / Write / Destructive** actions per connector
("API Connector Controls" with checkboxes), and a "mark connector read-only" toggle.
**Current state:** We have an action-type *filter* (view only) and per-member
read/read_write grants, but no per-connector cap on action classes.
**Recommended approach:** Add `allowed_risk_levels` (e.g. `['read','write']`) to the
`connections` row; enforce in `/api/execute`, the chat tool builder, and the skill/
playbook runners (skip/deny actions whose `risk` isn't allowed). UI: checkboxes on
the connector detail page.
**Effort:** Medium (1 migration + enforcement in ~4 call sites + UI).

### 2. User-facing feedback tracker — *raised by two testers*
**Ask:** Let users see the feedback they submitted, with a status (Under
consideration / In development / Implemented + release date).
**Current state:** `feedback.status` exists (new/acknowledged/actioned) but is
admin-only; no user view.
**Recommended approach:** Map internal statuses → friendly labels (Received →
Reviewing → Done), add `GET /api/feedback/mine`, and a "My feedback" list on the
Help/Guide page (or a small panel in the feedback widget). Optional `released_at`
column for the "Implemented on" date.
**Effort:** Small–Medium. **Most shovel-ready of these — good next build.**

### 3. Drag-and-drop Playbook builder
**Ask:** A visual node/arrow editor for playbooks (drag steps, connect them).
**Current state:** Playbooks are edited as an ordered list of step nodes.
**Recommended approach:** A canvas builder (e.g. React Flow) over the existing
`definition.steps` JSON — nodes = assess/action/condition/approval/notify/wait,
edges = `next`. Keep the JSON model; this is a new view on top of it.
**Effort:** Large (new editor UX). High wow-factor; schedule deliberately.

### 4. Connection-deletion behavior: per-user vs workspace setting
**Ask:** A tester felt "delete vs trash" is a platform/admin policy, not a personal
preference (an admin may want to *prevent* users changing it).
**Current state:** It's a per-user profile preference (`connection_delete_preference`).
**Recommended approach (decision needed):** Add a workspace-level default + an
"allow members to override" flag; fall back to per-user only when allowed. Small
build once the policy is decided.
**Effort:** Small, but **needs a product call first.**

---

## Other notable single mentions (not yet actioned)
- Restrict Orbit Assistant to Orbit-only topics (system-prompt scope). *(Medium)*
- "Connector Actions" page purpose unclear / feels redundant with per-connector view. *(Decide: keep, merge, or explain.)*
- Webhooks page: in addition to examples (done), consider a short "what is a webhook" primer.

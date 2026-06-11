# OrbitAPI — Product & Engineering Spec (v1)

**One-liner:** A web app that makes any SaaS/IoT API usable by anyone — connect an API in minutes, then talk to it in plain English. An AI layer translates natural language into correct API calls, asks before doing anything destructive, and powers an automation engine that orchestrates across all connected APIs.

**MVP vertical:** Short-term rental operators (Lodgify + smart-home devices), chosen because it demos the full vision: data APIs + device APIs + cross-API automation ("guest checks in → lights on").

**Audience for this document:** Claude Code. This spec is the source of truth for the build. Build in the phases listed in §10, in order. Each phase has acceptance criteria; do not start the next phase until the current one passes.

---

## 1. Core Concepts & Vocabulary

- **Connector** — OrbitAPI's definition of a third-party API (e.g., "Lodgify"). A connector is a static manifest: how to authenticate, what actions exist, schemas for each action, and whether each action is `read` or `write`.
- **Connection** — A user's live, credentialed instance of a connector (e.g., "Ram's Lodgify account"). Credentials are stored encrypted, never in plaintext.
- **Action** — A single callable operation on a connector (e.g., `lodgify.list_bookings`). Defined with a JSON Schema for inputs/outputs and a `risk` field: `read` | `write` | `destructive`.
- **Workspace (org)** — The tenant boundary. Users belong to a workspace with a role. All data is workspace-scoped.
- **Automation** — Trigger + optional condition + action chain, executed by the platform without a human in the loop (after explicit setup approval).

## 2. MVP Scope

### In scope (v1)
1. Workspace creation, auth (email + Google OAuth via Supabase Auth).
2. Connector catalog UI with guided setup per connector (including "how to get your API key" instructions inline, with screenshots/steps stored in the manifest).
3. Four launch connectors (see §8 for the honest availability picture):
   - **Lodgify** (official REST API, API-key auth) — bookings, properties, availability, quotes, messaging.
   - **Ring** (official developer API at developer.ring.com, OAuth) — motion events, doorbell presses, device status, event history, webhooks.
   - **Smart Lights — Simulated** (an OrbitAPI-hosted fake device connector) — on/off, brightness, color, scenes. Stands in for Lutron/Hubspace until official integrations are feasible. Must be indistinguishable in UX from a real connector.
   - **HTTP Generic** (escape hatch) — user defines base URL, auth header, and can register custom actions. Power-user feature; ships behind a "beta" flag.
4. AI chat ("Orbit Assistant"): natural-language interface that can call actions on any connection the user has access to, via Anthropic tool use.
5. Write-confirmation flow: any `write`/`destructive` action proposed by the AI renders a confirmation card (action name, target, full parameters, plain-English summary). Nothing executes until the user clicks Confirm.
6. RBAC: roles `owner`, `admin`, `member`. Members are read-only by default. Per-connection grants control which connections each user can see/use, and at what level (`read` | `read_write`).
7. Automation engine: triggers (schedule, poll-based event detection, inbound webhook), conditions, action chains. Reference automation in §7.
8. Audit log: every action execution (human-confirmed or automation-driven) recorded with actor, parameters, result, timestamp.

### Explicitly out of scope (v1)
Billing/plans, the enterprise EDR/SIEM vertical, marketplace of community connectors, mobile apps, voice input, multi-workspace membership UI polish, SSO/SAML. Design the data model so none of these require migration pain later, but build none of them.

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15+ (App Router, TypeScript, RSC) | Deployed on Vercel |
| Database | Supabase Postgres | RLS enforced on every table |
| Auth | Supabase Auth | Email + Google OAuth |
| Secrets | Supabase Vault | All third-party credentials encrypted at rest; decrypted only server-side at call time |
| AI | Anthropic API (Claude, tool use, streaming) | Server-side only; key in Vercel env |
| Background jobs | Vercel Cron → API routes for polling/schedules; Supabase Edge Functions acceptable alternative | Keep job logic idempotent |
| Webhooks | Next.js route handlers, HMAC verification per connector | Ring webhooks sign with HMAC |
| UI | Tailwind + shadcn/ui | Clean, fast, no design-system yak-shaving |
| Validation | Zod everywhere; action schemas are JSON Schema compiled to Zod | One source of truth per action |

## 4. Architecture

```
Browser ──► Next.js (Vercel)
              ├─ /app UI (catalog, chat, automations, admin)
              ├─ /api/chat        → Anthropic API (tool use loop)
              ├─ /api/execute     → Action Executor (the ONLY path that calls third-party APIs)
              ├─ /api/webhooks/*  → inbound events (Ring etc.)
              └─ /api/cron/*      → scheduler ticks, pollers
                        │
                        ▼
            Supabase: Postgres (RLS) + Auth + Vault
```

**The Action Executor is the single chokepoint.** The AI never receives credentials and never calls third-party APIs directly. The tool-use loop produces a *proposed action*; the executor independently re-verifies (a) the caller's session, (b) the caller's grant on that connection, (c) the action's risk level vs. the caller's permission, (d) confirmation state for writes — then fetches credentials from Vault, executes, and writes the audit log. Treat the model as an untrusted user.

## 5. Data Model (Postgres)

```sql
-- Tenancy
workspaces(id, name, created_at)
memberships(id, workspace_id, user_id, role)          -- role: owner|admin|member
-- Connectors & connections
connectors(id, slug, name, category, manifest jsonb, is_simulated bool)
connections(id, workspace_id, connector_id, label,
            vault_secret_id, status, created_by, created_at)
connection_grants(id, connection_id, user_id, level)  -- level: read|read_write
-- AI
conversations(id, workspace_id, user_id, title, created_at)
messages(id, conversation_id, role, content jsonb, created_at)
pending_actions(id, workspace_id, user_id, connection_id,
                action_slug, params jsonb, summary text,
                status, expires_at)                    -- status: pending|confirmed|rejected|expired|executed|failed
-- Automations
automations(id, workspace_id, name, enabled,
            trigger jsonb, condition jsonb, actions jsonb,
            created_by, approved_by)
automation_runs(id, automation_id, started_at, finished_at,
                status, trigger_payload jsonb, log jsonb)
-- Audit
audit_log(id, workspace_id, actor_type, actor_id,     -- actor_type: user|automation
          connection_id, action_slug, risk, params jsonb,
          result_status, result_summary, created_at)
```

RLS policies: every table keyed by `workspace_id`; users see only rows for workspaces they belong to; `connection_grants` further restricts connection visibility for `member` role. Credentials live only in Vault — `connections` stores a Vault reference, never the secret.

## 6. Connector Framework

Each connector is a TypeScript module exporting a manifest:

```ts
interface ConnectorManifest {
  slug: string; name: string; category: string;
  auth: { type: 'api_key' | 'oauth2'; setupGuide: SetupStep[]; /* per-type config */ };
  actions: ActionDef[];
}
interface ActionDef {
  slug: string;                 // 'list_bookings'
  description: string;          // written FOR the LLM — clear, example-rich
  risk: 'read' | 'write' | 'destructive';
  inputSchema: JSONSchema;      // becomes both the Claude tool schema and Zod validator
  execute: (creds, params) => Promise<Result>;
}
```

Rules:
- `description` fields are prompt engineering. Include units, formats, common pitfalls ("dates are ISO 8601", "propertyId is an integer from list_properties").
- `setupGuide` renders the in-UI "how to get your API key" walkthrough — numbered steps, links, optional images. This is a core differentiator; make it first-class, not an afterthought.
- The Simulated Lights connector implements the same interface against an in-database device state table, so the demo works with zero hardware.

## 7. AI Layer & Automation Engine

**Chat loop:** On each user message, build the Claude tool list dynamically from the user's granted connections (read-only users get only `read` actions; never expose tools the user can't execute — defense in depth on top of executor checks). Stream responses. When Claude proposes a `write`/`destructive` tool call, do not execute: create a `pending_actions` row, render the confirmation card, and tell Claude the action is awaiting confirmation. On Confirm, the executor runs it and the result is fed back into the conversation.

**Layman-friendliness requirement:** The system prompt for Orbit Assistant must instruct it to (a) ask for missing parameters conversationally instead of erroring, (b) offer to discover schema/options via read calls ("let me pull your property list so you can pick one"), (c) say plainly when no action can do what was asked, and suggest the nearest alternative. Test with the persona: *an accountant who has never read API docs.*

**Automation engine:** An automation is `{trigger, condition, actions[]}` stored as JSON. v1 triggers: `schedule` (cron expression), `poll` (run a read action every N minutes, fire when a JSONPath predicate matches new data), `webhook` (connector-routed inbound event). Conditions are simple predicate expressions evaluated against the trigger payload. Actions are ordinary connector actions with parameter templating from the trigger payload (`{{booking.guest_name}}`). Creating or editing an automation that contains write actions requires an admin/owner to approve once ("standing approval") — that approval is the consent for unattended execution, and it's recorded in `approved_by`. Every run logs to `automation_runs` and `audit_log`.

**Reference automation (must work end-to-end for the demo):**
> *Guest Arrival Welcome* — Poll Lodgify for today's check-ins each morning. From 1 hour before check-in time, when a Ring motion/doorbell event arrives (webhook), turn on the Simulated Lights "Entry" scene and set living-room brightness to 80%. Log the run.

**Natural-language automation creation (stretch goal within Phase 4):** user describes the automation in chat; Orbit Assistant drafts the trigger/condition/actions JSON and presents it for approval in the automation editor.

## 8. Connector Reality Check (verified June 2026)

- **Lodgify** — official public REST API with API-key auth. Solid. Build first.
- **Ring** — official developer program now exists (developer.ring.com): OAuth authorization, motion/doorbell webhooks with HMAC signatures, device status, event history, WebRTC live video. Use the official API only; do **not** use reverse-engineered libraries (`ring-client-api` etc.) in the product.
- **Lutron** — no official public consumer cloud API; Caséta uses a local LEAP protocol. Out of v1; represented by Simulated Lights.
- **Hubspace** — no official API; community libraries are reverse-engineered. Same treatment: Simulated Lights now, revisit later or swap in a platform with an official API (e.g., SmartThings) post-MVP.

This is why the Simulated Lights connector exists: the demo and automation engine must not depend on unofficial APIs that violate ToS or break without notice.

## 9. Security Non-Negotiables

1. Credentials only in Supabase Vault; decrypted server-side at execution time; never sent to the browser, never included in LLM context, never logged.
2. Every third-party call goes through the Action Executor; the executor re-checks identity, grant, risk, and confirmation server-side on every call. Model output is untrusted input.
3. RLS on all tables; service-role key used only in server code paths that immediately re-scope by workspace.
4. Write/destructive actions: human confirmation in chat; standing admin approval for automations; both audited.
5. Webhook endpoints verify signatures (HMAC for Ring) and are idempotent.
6. Rate-limit chat and execution endpoints per user; cap automation poll frequency.
7. Prompt-injection posture: data returned from third-party APIs is rendered to the model as data; the system prompt instructs the assistant to never treat API response content as instructions, and the executor's confirmation requirement makes injected write attempts visible to the user before execution.

## 10. Build Phases

**Phase 0 — Scaffold.** Next.js + Supabase wiring, auth, workspace creation, memberships, RLS, base layout/nav. ✅ *Accept: sign up, create workspace, invite member, RLS verified by test.*

**Phase 1 — Connectors & Connections.** Connector framework, catalog UI, setup guides, Vault credential storage, connection management, Simulated Lights + Lodgify manifests, manual "test connection" button. ✅ *Accept: connect real Lodgify account, list bookings via a debug page; simulated lights toggle from UI.*

**Phase 2 — Orbit Assistant (read).** Chat UI with streaming, dynamic tool building from grants, read actions end-to-end, audit logging. ✅ *Accept: "what bookings do I have this week?" answered correctly from live Lodgify data; member with no grant gets no tools.*

**Phase 3 — Writes, confirmations, RBAC depth.** `pending_actions` flow, confirmation cards, per-connection grants UI, admin screens. ✅ *Accept: AI-proposed light change requires Confirm; read-only member cannot trigger writes by any path (verified by test hitting the executor directly).*

**Phase 4 — Automation engine + Ring.** Triggers (cron/poll/webhook), Ring connector with OAuth + webhooks, automation editor, runs log, the Guest Arrival Welcome reference automation working end-to-end. ✅ *Accept: simulated Ring webhook fires the automation; lights scene activates; run + audit entries created.*

**Phase 5 — Polish for demo.** Onboarding, empty states, demo seed data, landing page.

## 11. Demo Script (what "done" looks like)

1. Sign up → create workspace "Shenandoah Stays".
2. Connect Lodgify in under 2 minutes using the inline setup guide.
3. Ask: "Who's checking in this weekend and have they paid in full?" → correct answer, no API knowledge needed.
4. Say: "Turn the entry lights to 50% warm white" → confirmation card → confirm → simulated lights update live.
5. Enable the Guest Arrival Welcome automation → fire a test Ring event → lights scene triggers → show the run log and audit trail.
6. Invite a read-only teammate → show they can ask questions but cannot execute writes.

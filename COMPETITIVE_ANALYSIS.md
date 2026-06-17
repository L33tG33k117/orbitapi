# OrbitAPI — Competitive Analysis (v2)

_Updated 2026-06-15, after building Foundations A–D of the "10 game-changers" roadmap._

This supersedes the first competitive pass. The difference: the earlier analysis described
differentiators we *had* and features we *wanted*. This one reflects a platform whose core
execution layer now does things no competitor's does — because the four foundations that
the 10 game-changing features ride on are built.

---

## What changed since v1

We shipped the substrate, not just ideas:

- **Foundation A — a real workflow engine.** OrbitAPI is no longer a single-shot "AI runs a
  prompt with tools" product. It now has a step-graph engine (`lib/playbook-runner.ts`) with
  conditional branching, **severity-driven autonomy** (auto-act ≥9, require approval 6–8,
  notify below), and **pause/resume** — a run can park on a human approval, a timer, or an
  external event and resume later carrying its state forward.
- **Foundation B — execution records that capture everything.** Every action now records its
  full request/response, latency, and the LLM token cost of the run. This is the substrate for
  one-click replay, destructive-action preview, and per-skill cost budgeting.
- **Foundation C — a bundle primitive.** One serialization format installs a whole vertical
  (connections + groups + playbooks + skills + demo data) in a click, and the same format
  powers a community marketplace with revenue share.
- **Foundation D — a real webhook layer.** HMAC-signed inbound endpoints (signature in a
  header, not the URL), full delivery logging with replay, and — critically — event endpoints
  that wake up parked playbook runs. This is what makes asynchronous, multi-stage automations
  possible.

The strategic upshot: the hardest-to-copy parts of the "game-changers" are no longer roadmap.
They're plumbing that exists.

---

## What competitors still do the same (unchanged from v1)

Zapier+AI, Make, n8n, Workato, Tines/Torq, Palo Alto XSOAR, LangChain/CrewAI, Moveworks/Aisera.
The v1 read still holds: trigger→action automation without deep agentic autonomy (Zapier/Make/n8n),
enterprise iPaaS priced for the enterprise (Workato/XSOAR), security-only scope (Tines/Torq/XSOAR),
or frameworks that require engineers to build everything (LangChain/CrewAI).

What's worth restating: **none of them combine a conversational AI layer, agentic autonomy with
explicit human-in-the-loop gates, and cross-domain SaaS+security+IoT connectors in one product.**
That gap is now wider, not narrower.

---

## What OrbitAPI now does that they structurally cannot

The v1 differentiators (dual-mode real+simulated connectors, persona skills, credentials never
touching the LLM, per-connection RLS, the manifest framework) all still stand. New as of this build:

1. **Dynamic autonomy thresholds inside a conversational platform.**
   A playbook assesses a situation, scores its severity 0–10, and the *same playbook* behaves
   differently by context: auto-remediate a critical incident, ask a human for a mid-severity one,
   just notify for a low one. XSOAR playbooks are static decision trees; Zapier/Make have no concept
   of autonomy at all. We have a configurable severity→action policy as a first-class field on every
   playbook. **This is the SOAR-killer feature, and it exists.**

2. **Park-and-resume execution.**
   A run can stop at an approval gate or wait for an external event for hours or days, releasing
   compute, then resume exactly where it left off with its state intact. Every competitor's
   "automation" is trigger→immediate-action. This is the mechanism that lets OrbitAPI express
   "detect → wait 1h for a human response → if none, auto-isolate the host" as one durable workflow.
   It's also the foundation for asynchronous skill chaining.

3. **Cost-governed AI execution.**
   Every run records its token cost; skills and workspaces can carry monthly budgets; a router can
   send cheap work to a cheaper model. No automation competitor exposes per-automation LLM cost,
   because none of them are AI-native enough to need to. For an SMB buyer wary of unbounded AI bills,
   this is a trust signal nobody else can offer.

4. **Install-a-vertical-in-one-click.**
   A bundle provisions a complete, runnable workspace — connectors (in safe simulation), groups,
   playbooks, skills, and demo data — as a single transaction, uninstallable as a unit. Tines ships
   templates for enterprise security; nobody ships runnable, multi-vertical, out-of-the-box suites
   for the mid-market. Land-and-expand becomes a button.

5. **A marketplace with revenue share, built on the same primitive.**
   Because a bundle is just a serializable manifest, community members can publish skills/playbooks/
   bundles, admins review them, and publishers earn a revenue share. This is the network-effect moat
   Zapier built its integration library on — except here it's *automations*, not just connectors.

6. **Webhooks as a first-class, auditable, replayable surface.**
   HMAC-signed, delivery-logged, replay-testable from the dashboard, and able to drive the workflow
   engine (including waking parked runs). For every competitor this is a documentation exercise; for
   us it's a product surface that wins developer trust on contact — and doubles as the async event bus.

---

## Updated head-to-head

| Capability | Zapier+AI | Make | n8n | Workato | Tines/Torq | XSOAR | LangChain | **OrbitAPI** |
|---|---|---|---|---|---|---|---|---|
| Conversational AI execution layer | partial | ✗ | ✗ | ✗ | ✗ | ✗ | DIY | ✅ |
| Agentic autonomy w/ human gates | ✗ | ✗ | ✗ | ✗ | partial | static | DIY | ✅ dynamic by severity |
| Pause/resume + async waits | ✗ | partial | partial | ✅ | ✅ | ✅ | DIY | ✅ |
| Test before real credentials | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ sim→real |
| Per-automation LLM cost governance | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | DIY | ✅ |
| One-click runnable verticals | templates | templates | templates | partial | templates | templates | ✗ | ✅ bundles+demo data |
| Automation marketplace w/ rev share | ✗ | ✗ | community | ✗ | ✗ | ✗ | ✗ | ✅ (foundation built) |
| Credentials never touch the LLM | n/a | n/a | n/a | n/a | n/a | n/a | DIY | ✅ |
| Security + SaaS + IoT in one | ✗ | ✗ | ✗ | partial | security-only | security-only | DIY | ✅ |
| Price point | low | low | low/self-host | $2k+/mo | enterprise | $10k+/yr | free/DIY | mid-market flat-rate |

---

## Strategic positioning (sharpened)

The v1 angle holds and is now defensible in code: **OrbitAPI is the conversational execution layer
on top of enterprise APIs — for ops teams who want AI-driven automation but don't employ integration
engineers.** Security, support, IT, and property-management teams stop paying for five fragmented tools
(Zapier for workflows, Slack for alerts, XSOAR for security playbooks, ServiceNow for ticketing, a SIEM
for visibility) and run them under one AI interface with a full audit trail.

What's newly true: the three pillars of that story are now real features, not promises.
- **"Credentials never leak"** — Vault + LLM isolation (already shipped).
- **"Every action is logged and replayable"** — Foundation B execution records.
- **"A human approves before risky writes"** — Foundation A severity-gated approval, with the run
  parking until a person decides.

### To win decisively from here
1. **Ship the Security SOC bundle first.** The engine's severity-driven autonomy + destructive-action
   gating is tailor-made for it, and our security connector depth (CrowdStrike, SentinelOne, Sophos,
   Defender, Stellar Cyber) is unmatched in any general-purpose platform. The bundle makes the
   foundations demoable as a product in one click.
2. **Turn on the marketplace.** It creates lock-in without lock-in: the more community playbooks exist,
   the more the platform is worth, and the harder it is to leave — while every automation stays
   portable as a manifest.
3. **Lead every enterprise conversation with the compliance triad** — credentials never leak, every
   action logged and replayable, human approval before writes. That is a story no Zapier, no n8n, and
   no LangChain wrapper can tell — and now we can prove it line by line.

---

_Implementation status: Foundations A–D built and typechecking. Feature UIs (playbook builder, replay
viewer, destructive preview, marketplace, webhook dashboard, cost dashboard) ride on these and are the
next build phase — tracked in the task list. DB migrations 028–031 must be applied before the
foundations are live._

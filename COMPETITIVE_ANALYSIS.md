# OrbitAPI — Competitive Analysis (v3)

_Updated 2026-07-02. Supersedes v2 (2026-06-15). v2's foundation inventory (workflow engine,
execution records, bundles, webhooks) still holds; this update refreshes the outside world,
which moved fast in the last two quarters._

---

## What changed in the market since v2

1. **Zapier completed its pivot to an "AI Orchestration Platform."** AI Agents are GA, Copilot
   builds Zaps from natural language, and their MCP server exposes 30,000+ actions to external
   LLMs. As of June 15, 2026 they price AI steps by model tier (Standard 1x / Advanced 3x /
   Premium 5x). Implication: "we're the AI-powered automation tool" is no longer a
   differentiator by itself — the incumbent says the same sentence.

2. **A non-technical AI-agent cohort has consolidated: Lindy, Gumloop, Relay.app.**
   - **Lindy** ("AI Employee", $49.99–$199.99/mo, credit-based) owns the delegation story —
     agents that read email, respond, schedule. Widely criticized for credit anxiety: credits
     don't roll over and agents *pause mid-work* when they run out.
   - **Gumloop** is the Zapier-like canvas with modern AI nodes; strongest for complex flows.
   - **Relay.app** ($27/mo Professional) is the direct collision with us: their whole identity
     is *human-in-the-loop approvals + simplicity for non-technical teams*. Our approval story
     is no longer unique in the SMB segment — and they undercut our Starter price.

3. **MCP commoditized the connector layer.** Composio (500+ LLM-optimized toolkits) and
   Pipedream (3,000+ APIs, 10,000+ tools — acquired by **Workday** in late 2025) sell
   "connect your AI to any app" as infrastructure. ChatGPT and Claude now connect to SaaS apps
   natively. The raw capability "talk to your apps in plain English" is being absorbed by the
   assistants themselves.

---

## What still holds from v2

The structural differentiators remain real and shipped:

- **Sim→real connectors** — try any connector with zero credentials, then convert. Still not
  offered by any competitor in any segment. This is our single most "for the masses" feature.
- **Severity-driven autonomy + park/resume** — one playbook that auto-acts, asks, or notifies
  by confidence, and can wait hours/days at a gate. Relay has approvals; it does not have
  graduated autonomy or durable parked runs.
- **Cost-governed AI (AI Power)** — flat monthly pool + top-ups, no per-model math. Against
  Zapier's new model-tier pricing and Lindy's credit fatigue, *predictability is now a
  first-class selling point*, not a footnote.
- **Bundles with demo data** — install a runnable vertical in one click, in simulation.
- **Credentials never touch the LLM; per-connection RLS; full audit + replay.**
- **Cross-domain depth including security connectors** (CrowdStrike, SentinelOne, Sophos,
  Defender, Stellar Cyber) — no non-technical platform has this.

## Updated head-to-head (deltas only)

| Capability | Zapier | Relay.app | Lindy | Gumloop | Composio/Pipedream | **OrbitAPI** |
|---|---|---|---|---|---|---|
| Plain-English execution | ✅ Copilot/Agents | partial | ✅ | partial | via host LLM | ✅ |
| Human approval gates | partial | ✅ core identity | partial | ✗ | ✗ | ✅ + severity-graduated |
| Try before credentials | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ sim→real |
| Predictable AI cost | ✗ model-tier | ✅ simple | ✗ credit anxiety | credits | n/a | ✅ flat pool |
| Durable park/resume runs | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| Security/SOC depth | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| MCP surface | ✅ 30k actions | ✗ | ✗ | ✗ | ✅ core product | ✗ **(gap)** |
| Entry price | $29.99 + AI add-ons | $27 | $49.99 | free credits | dev-priced | $49 Starter |

---

## Recommendations (ordered)

1. **Ship an MCP server surface.** Expose each workspace's connected APIs (with the same
   risk-gating and approval flow) as an MCP endpoint so users can drive their Orbit connectors
   from Claude/ChatGPT/Cursor. This converts the biggest structural threat (assistants eating
   the "chat with your apps" use case) into distribution — Orbit becomes the *governed
   credential + approval layer* under whatever assistant the user already lives in. Nobody in
   the SMB cohort has this; only Zapier and the dev-tools do.
2. **Weaponize pricing predictability in marketing.** "No credits. No model math. Your agents
   never stop mid-task." — direct hit on Lindy's pause-on-empty and Zapier's 1x/3x/5x tiers.
3. **Answer Relay.app.** They own "approvals + simple" at $27. Our counter is *graduated*
   autonomy (approve only what matters, auto-act on the safe stuff) + sim mode + audit/replay.
   Consider a lower-priced entry tier or a more generous free tier to remove the price shadow.
4. **Lead demos with sim→real.** It is the only "try the whole product with zero risk and zero
   setup" experience in the market and perfectly matches "API for the masses."
5. **Ship the Security SOC bundle** (unchanged from v2) — the severity engine + security
   connector depth remains the wedge no horizontal player can follow into.
6. **Keep the marketplace on the roadmap but sequence it after MCP** — network effects need
   traffic first; MCP brings the traffic.

_Sources: Zapier AI model-based pricing announcement (help.zapier.com, June 2026); Zapier/
Gumloop/Lindy/Relay comparison coverage (gumloop.com, lindy.ai, zapier.com blogs, 2026);
Lindy & Relay pricing guides (cloudtalk.io, lindy.ai, 2026); Composio & Pipedream MCP docs and
Workday acquisition coverage (composio.dev, pipedream.com, klavis.ai, 2025–2026)._

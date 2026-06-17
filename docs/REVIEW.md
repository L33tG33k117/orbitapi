# OrbitAPI — Product Review & Differentiation Strategy

A full review of the site + tools with prioritized ideas to make OrbitAPI stand out.
Theme to anchor every decision: **"API for Dummies" — empower non-technical people to use
APIs, and break the limits their app dashboards impose on them.**

---

## The thesis (what we're really selling)

Most people never touch an API because (a) it's intimidating and (b) they don't know it's
even an option. But the API can do things the polished dashboard *won't let you*:

> Zendesk only shows 90 days of tickets in the UI. The API has **all of it**. Stripe caps
> exports. Most SaaS dashboards hide pagination, throttle bulk, and bury historical data.

**OrbitAPI's wedge: "Your data has no dashboard handcuffs."** We let a non-technical person, in
plain English, do the things that previously required a developer + the raw API. That single
promise is more differentiated than "another automation tool."

Everything below ladders up to that.

---

## Tier 1 — Flagship differentiators (the big bets)

### 1. ⭐ Data Liberation — "get everything, not just what the dashboard shows"
This is the strongest wedge and it's **not built yet** (connector actions are single-call; no
pagination/bulk/export). Build it and lead marketing with it.

- **Auto-pagination:** let `list`-type actions declare a pagination shape so the runner loops
  until complete ("pull ALL tickets," not page 1). Add optional `paginate` metadata to `ActionDef`.
- **Export sinks:** stream results to **CSV download, Google Sheets, or email** — "Export every
  Zendesk ticket from 2021 to a spreadsheet." A reusable "export" step any skill/playbook can end with.
- **Cross-app joins:** "match Stripe customers to Zendesk tickets and export the overlap." This is
  the thing no dashboard can do at all.
- **Positioning line:** *"The export button your apps never gave you."*

Why it wins: Zapier/Make are trigger→action, not bulk/historical; Postman is for developers.
Nobody serves "non-technical person needs all their historical data out of a SaaS UI."

### 2. AI that explains, not just executes
Reinforce "for Dummies": every result gets a plain-English **"what this means"** summary and a
**suggested next step** ("3 invoices are >30 days overdue — want me to email them?"). Turns raw API
output into guidance. Cheap to add (already have the model in the loop) and very on-brand.

### 3. Outcome library (one-click "I want to…")
Bundles exist for connectors+skills; add an **outcomes** layer phrased as goals, not features:
"Export all my [app] history," "Alert me when [thing] happens," "Weekly summary of [data]." A
non-technical user picks an outcome, connects the app, done. This is the on-ramp that makes the
catalog feel like magic instead of a toolbox.

### 4. Natural-language scheduling & triggers
"Every Monday at 9, email me last week's bookings." Parse plain English → schedule/trigger. Removes
the last technical-feeling surface (cron pickers). Pairs perfectly with skills.

---

## Tier 2 — High-leverage improvements

- **Tailored assistant suggestions:** the chat starter prompts are static (`DEFAULT_SUGGESTIONS`).
  Generate them from the user's *connected* apps ("Show your recent CrowdStrike detections" only if
  CrowdStrike is connected). Much higher first-message success.
- **Rich result rendering:** render list/table data as actual tables with **Copy** and **Export CSV**
  buttons inline in chat — not prose. Directly serves the data-liberation theme.
- **Assistant → skill nudge:** after a good multi-step chat, have Orbit *offer* "Want me to save this
  as a reusable skill?" (we added a button; an inline offer converts better).
- **Resilient AI errors (still open):** we discussed but never shipped the friendly
  "Orbit's AI is busy, retrying…" handling with backoff + Economy fallback on 529s. Worth doing before
  testers hit a raw "Overloaded."
- **First-run / onboarding polish:** make the very first session land the loop: connect (or Simulate)
  → ask → see result → save skill. A guided 3-step checklist on the dashboard until completed.
- **Dashboard as mission control:** show "what can I do right now" (connected apps + suggested
  actions), recent runs, and AI Power at a glance — instead of a static overview.

---

## Tier 3 — Beta polish (quick wins before/while testing)

- **Empty states everywhere** with a single "try this" CTA (skills, playbooks, groups, webhooks).
- **Mobile pass** — the dashboard/sidebar should be usable on a phone for quick checks.
- **Friendly, branded error copy** app-wide (never leak provider/model names — already the rule).
- **"Simulated" clarity** — make it obvious testers can try any connector with fake data risk-free.
- **Shareable run results** — a read-only link to a run/audit entry to paste into feedback.
- **Loading/skeleton states** on data-heavy pages to feel fast.

---

## The moat (why we beat the field)

| Competitor | Their gap | OrbitAPI |
|---|---|---|
| Zapier / Make | Visual node graphs; trigger→action; not bulk/historical | Plain English; bulk + historical export; autonomy |
| Postman / raw API | Developer-only | Built for non-technical users |
| Vendor dashboards | Hide history, cap exports, throttle bulk | **Liberate the full data** |
| Other AI agents | Generic, no governance | Approvals + full audit + one-click replay; hidden model/efficiency; simple credits |

**Compounding moat:** the AI connector builder (Discover → request → auto-built connector) means the
catalog **expands itself** — coverage grows faster than competitors can hand-build integrations.

---

## Suggested sequence

1. **Now (beta):** Tier 3 polish + tailored suggestions + resilient AI errors → make the trial feel great.
2. **Next (the wedge):** Data Liberation (auto-pagination + CSV/Sheets/email export). This is the
   headline feature and the clearest reason to choose OrbitAPI.
3. **Then:** "AI explains," outcome library, natural-language scheduling.

Lead all messaging with the limitation-breaking promise. That's the story competitors can't tell.

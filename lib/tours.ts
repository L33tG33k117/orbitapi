// Interactive product-tour definitions, one per major page. Each step either
// targets a real element by its `data-tour="..."` attribute (spotlight + tooltip)
// or omits `element` to show a centered intro/outro card.
//
// Goal: get someone with ZERO API experience comfortable. Every tour opens by
// explaining what the page is for in plain language, walks through everything
// they can actually use, teaches the API concept as it goes, and ends by
// pointing at the natural next step.
//
// Driver.js consumes these (see components/page-tour.tsx). Adding a new tour:
//   1. add a `data-tour="x"` attribute to the real element(s) on the page
//   2. add an entry here keyed by the route (or a dynamic match in getTour)
// Steps whose element isn't on the page are shown as centered cards, so a
// dismissed/absent element never breaks the tour.

export interface TourStep {
  element?: string
  popover: {
    title: string
    description: string
    side?: 'top' | 'bottom' | 'left' | 'right' | 'over'
    align?: 'start' | 'center' | 'end'
  }
}

export interface Tour {
  key: string
  steps: TourStep[]
}

// A closing card that points at the natural next step for this page, plus the
// two things that are always available (Assistant + re-running the tour).
function outro(nextStep: string): TourStep {
  return {
    popover: {
      title: "That's the tour!",
      description:
        `${nextStep} You can replay this any time with “Show me around” at the top, and the ` +
        `Orbit Assistant (bottom-right) answers questions in plain English whenever you're stuck.`,
    },
  }
}

const TOURS: Record<string, Tour> = {
  '/dashboard': {
    key: 'dashboard',
    steps: [
      { popover: { title: 'Welcome to OrbitAPI 👋', description: 'Quick idea first: every app you use (Slack, QuickBooks, your booking system…) has an “API” — a doorway that lets other software read its data and do things in it. Normally you need a developer to use that doorway. OrbitAPI is that developer for you — you ask in plain English, it does the API part. This 60-second tour shows you around.' } },
      { element: '[data-tour="dash-orbit"]', popover: { title: 'Your apps, in orbit', description: 'Each app you connect appears here as its own logo, circling your workspace. Hover to pause the motion, then click any logo to jump straight into that app. It’s your live map — a quick glance shows what’s connected and healthy (green dots) or needs attention (amber/red).', side: 'left' } },
      { element: '[data-tour="dash-stats"]', popover: { title: 'Your numbers at a glance', description: 'Once you connect apps, these show how much is happening — connected apps, actions today, active skills, and calls this month. Each card is a link to the full view.', side: 'bottom' } },
      { element: '[data-tour="dash-getstarted"]', popover: { title: 'Your starting checklist', description: 'Five small steps that build on each other: connect an app → ask a question → save it as a “skill” → group your apps → let it run on its own. It ticks itself off as you go and disappears once you’re set up (so you won’t always see it here).', side: 'top' } },
      { element: '[data-tour="dash-assistant"]', popover: { title: 'The fastest way to try it', description: 'Orbit Assistant is a chat. You type “show me today’s bookings” and it uses your connected apps to answer — no code, no menus. This is where most people start.', side: 'bottom', align: 'end' } },
      { element: '[data-tour="sidebar-nav"]', popover: { title: 'Everything lives here', description: 'The sidebar is grouped so it stays calm: Connect (your apps), Automate (skills & playbooks that do work for you), Operate (approvals, triggers), and Insights (what happened, and your AI Power). Locked items show what they do — you don’t have to guess.', side: 'right' } },
      outro('Next: open API Connectors and add your first app — or just try a Simulated one, no keys needed.'),
    ],
  },

  '/connectors': {
    key: 'connectors',
    steps: [
      { popover: { title: 'API Connectors — the foundation', description: 'A “connector” is just a ready-made link to one app’s API. Connect an app here and Orbit can read its data and take actions in it for you. Everything else in OrbitAPI acts through what you connect on this page.' } },
      { element: '[data-tour="connector-search"]', popover: { title: 'Find an app', description: 'Search 100+ apps by name or category. Don’t see yours? There’s a “request a connector” form at the bottom of the page.', side: 'bottom' } },
      { element: '[data-tour="connector-catalog"]', popover: { title: 'Two ways to add one', description: 'Every card offers “Connect” (paste that app’s real API key — your key is encrypted and never shown to the AI) or “Simulate” (try it instantly with realistic fake data, no key at all). New here? Simulate first — it behaves exactly like the real thing so you can learn safely.', side: 'top' } },
      { element: '[data-tour="connection-actions"]', popover: { title: 'Using an app you’ve added', description: 'Each connected app has buttons: “Use now” opens a simple point-and-click screen to run things and get answers, “Manage” shows its settings and full capabilities, and “Test” checks the connection is healthy.', side: 'left' } },
      outro('Next: click “Use now” on any connected app to run your first API action — with a form, not code.'),
    ],
  },

  '/skills': {
    key: 'skills',
    steps: [
      { popover: { title: 'Skills — your reusable helpers', description: 'A Skill is a saved AI helper with a job description (a “persona”) — like “every morning, list large invoices and message me the total.” You set it up once; then run it on demand or on a schedule. It works across the apps you give it.' } },
      { element: '[data-tour="skill-templates"]', popover: { title: 'Start from a template', description: 'Not sure where to begin? These ready-made skills are pre-written for common jobs — pick one and tweak the wording. Fastest way to see a skill work.', side: 'top' } },
      { element: '[data-tour="skill-create"]', popover: { title: 'Or build your own', description: 'Give it a name, choose which apps it may use, describe its job in plain English, and pick how it runs: Supervised (it shows what it *would* do — safe rehearsal), Manual (you press go), or Autonomous (it runs on a schedule by itself).', side: 'bottom' } },
      { popover: { title: 'Nothing runs blindly', description: 'Anything that changes or deletes data can be set to pause for your approval first. A skill only ever touches the apps you hand it — you’re always in control.' } },
      outro('Next: open a skill and hit “Test run” to watch it work safely against real data without changing anything.'),
    ],
  },

  '/playbooks': {
    key: 'playbooks',
    steps: [
      { popover: { title: 'Playbooks — step-by-step automations', description: 'A Skill figures out its own steps; a Playbook is when you want an exact, repeatable sequence with branching — “do A, check B, if serious do C, otherwise just notify.” Great for incident response and any process that must run the same way every time.' } },
      { element: '[data-tour="playbook-create"]', popover: { title: 'Build on a canvas', description: 'Start from a template or blank, then drag steps together. Step types: Assess (read & judge), Action (do something), Condition (branch), Approval (pause for a human), Notify, and Wait.', side: 'bottom' } },
      { popover: { title: 'The safety dial', description: 'Each playbook has an Autonomy Policy — a severity dial. Low-severity situations can run automatically; high-severity ones can require a human to approve first. You decide where that line sits.' } },
      outro('Next: install a Bundle (in the sidebar) to get proven playbooks pre-built, then tweak them.'),
    ],
  },

  '/bundles': {
    key: 'bundles',
    steps: [
      { popover: { title: 'Bundles — a working setup in one click', description: 'A Bundle is a ready-made pack — the right connectors, groups, skills, and playbooks for a job (Security, Support, Property Management…). Instead of building from scratch, install one and you have working automations immediately.' } },
      { element: '[data-tour="bundles-list"]', popover: { title: 'See inside before you install', description: 'Every bundle has “See what’s inside” — expand it to review exactly which apps, skills, and playbooks you’ll get. Install reuses apps you already have (no duplicates) and can swap in a different vendor.', side: 'top' } },
      { popover: { title: 'Where it lands', description: 'After installing, the pack’s skills appear in your Skills tab (badged with the bundle name), playbooks in Playbooks, and any new apps in Connectors. The install screen links you straight to them.' } },
      outro('Next: install a bundle that matches your work, then open its skills and run one.'),
    ],
  },

  '/groups': {
    key: 'groups',
    steps: [
      { popover: { title: 'Groups — optional, but handy', description: 'A Group is a named set of apps — e.g. a “Finance” group with just QuickBooks + Slack. It lets a skill touch only the apps that belong to one job, instead of everything you’ve connected. You can skip this on day one.' } },
      { element: '[data-tour="group-create"]', popover: { title: 'Create a group', description: 'Name it and add connections. Later, when you build a skill, you can scope it to a single group so it stays focused and safe.', side: 'bottom' } },
      outro('Next: create a skill (in the sidebar) and point it at a group you’ve made.'),
    ],
  },

  '/playground': {
    key: 'playground',
    steps: [
      { popover: { title: 'Playground — run everything in one place', description: 'Your apps, skills, and playbooks are each set up in their own section — this is the one spot to actually run any of them and grab the result, without hopping around.' } },
      { element: '[data-tour="playground-run"]', popover: { title: 'Run anything', description: '“Use now” on an app opens the point-and-click runner. “Run” on a skill or playbook fires it right here. Everything you’ve set up is listed, ready to go.', side: 'bottom' } },
      { element: '[data-tour="playground-results"]', popover: { title: 'See & export the output', description: 'The moment something finishes, it appears here with its result — and an Export button to save the data as Excel, CSV, PDF, or Word. This is your answer to “where did that number go?”', side: 'top' } },
      outro('Try it: hit “Use now” on an app or “Run” on a skill, then export the result from here.'),
    ],
  },

  '/approvals': {
    key: 'approvals',
    steps: [
      { popover: { title: 'Approvals — your safety net', description: 'When a skill or playbook wants to change or delete something, it can pause here and wait for your sign-off. Nothing risky happens until you say yes. This is what makes automation safe to trust.' } },
      { element: '[data-tour="approvals-legend"]', popover: { title: 'Read / Write / Destructive', description: 'Every action has a risk level. “Read” (just looking up data) runs freely. “Write” (creating/updating) and “Destructive” (deleting, disabling) can require approval — and destructive ones ask you to jot a quick “how I’d undo this” plan first.', side: 'bottom' } },
      { element: '[data-tour="approvals-filter"]', popover: { title: 'Pending vs history', description: 'Switch between what’s waiting on you now and the full record of what was approved or rejected before.', side: 'bottom' } },
      outro('Nothing to approve yet? That’s normal — items appear here once a skill proposes a change.'),
    ],
  },

  '/webhooks': {
    key: 'webhooks',
    steps: [
      { popover: { title: 'Webhooks — let other apps start things', description: 'A webhook is a secure web address you give another app. When something happens over there (a payment, a new ticket), that app “pings” your address and Orbit kicks off a skill or playbook — instantly, no checking on a timer.' } },
      { element: '[data-tour="webhooks"]', popover: { title: 'Start from a recipe', description: 'Pick a ready-made recipe (Stripe payment, GitHub issue, Typeform response…) or start blank. You get a URL + signing secret to paste into the other app, and choose which skill or playbook it fires. Every delivery is logged and replay-testable.', side: 'top' } },
      outro('This is a more advanced trigger — most people start by running skills manually or on a schedule first.'),
    ],
  },

  '/usage': {
    key: 'usage',
    steps: [
      { popover: { title: 'Usage — your activity at a glance', description: 'A simple report of how much you’re doing: API calls over time, which apps are busiest, and any errors. Good for spotting trends and showing your team the value.' } },
      { element: '[data-tour="usage-range"]', popover: { title: 'Pick a date range', description: 'Choose a preset window or a custom range — the whole report updates to match.', side: 'bottom' } },
      { element: '[data-tour="usage-export"]', popover: { title: 'Export a report', description: 'Download a clean PDF of the current range to share with your team or stakeholders.', side: 'bottom', align: 'end' } },
      outro('Tip: the Activity page shows the individual answers and lets you export any single result.'),
    ],
  },

  '/activity': {
    key: 'activity',
    steps: [
      { popover: { title: 'Activity — where your answers live', description: 'Every question you ask and every action that runs is saved here, newest first. So when you think “what was that number from last week?”, this is where you come back to find it.' } },
      { element: '[data-tour="activity-filters"]', popover: { title: 'Find a past result', description: 'Search by keyword, or filter by source (manual, skill, playbook), status, and date. Handy once you’ve got a lot of history.', side: 'bottom' } },
      { element: '[data-tour="activity-list"]', popover: { title: 'Open any result', description: 'Click a row to see the full answer in a friendly table — and export it to Excel, CSV, PDF, or Word. Actions you ran manually can be re-run with fresh data in one click.', side: 'top' } },
      outro('This is your paper trail — every result is here to revisit and export whenever you need it.'),
    ],
  },

  '/ai-power': {
    key: 'ai-power',
    steps: [
      { popover: { title: 'AI Power — the fuel', description: 'Everything the AI does — every chat answer, skill run, and playbook — uses a little “AI Power.” Your plan includes a monthly pool of it. This page is where you see how much is left and control how fast it’s spent.' } },
      { element: '[data-tour="aipower-meter"]', popover: { title: 'What’s left this cycle', description: 'Your remaining AI Power. If it runs low, you can add a top-up Power Pack or upgrade your plan — no automation ever charges you by surprise.', side: 'bottom' } },
      { popover: { title: 'Economy → Maximum', description: 'You can set how much “horsepower” each skill uses. Economy stretches your Power further for simple, high-volume jobs; Maximum gives your most important automation the smartest model. Set a sensible default and override per skill.' } },
      outro('Tip: set high-volume skills to Economy and save Maximum for the ones that really matter.'),
    ],
  },

  '/mcp': {
    key: 'mcp',
    steps: [
      { popover: { title: 'Connect your AI', description: 'Already use Claude, ChatGPT, or Cursor? This turns OrbitAPI into a tool *they* can use. Your connected apps become things your AI assistant can operate directly — while your keys stay locked in here.' } },
      { element: '[data-tour="mcp-endpoint"]', popover: { title: 'Your secure server URL', description: 'Generate a URL and paste it into your AI tool’s settings. From then on it can read your apps’ data instantly; anything that changes something still waits on your Approvals page, and every call is logged.', side: 'top' } },
      outro('Optional power feature — you can safely ignore it until you want your own AI assistant to use your apps.'),
    ],
  },

  '/audit': {
    key: 'audit',
    steps: [
      { popover: { title: 'Audit Log — the governance record', description: 'This is your compliance trail. Two tabs: “Changes” = who changed what (settings, members, connectors, access), and “Actions” = the detailed log of everything that ran. Activity is the friendly “what happened” view; this is the source-of-truth detail.' } },
      { popover: { title: 'Who changed what', description: 'The Changes tab answers questions like “who turned off approvals?” or “who added that member?” — each entry names the person, the change, and when.' } },
      { popover: { title: 'Replay an action', description: 'On the Actions tab, expand any entry for its full inputs and response, then “Replay with fresh data” to run it again and compare.' } },
      outro('You rarely need this day-to-day — it’s here the moment you need to prove exactly who did what.'),
    ],
  },

  '/reference': {
    key: 'reference',
    steps: [
      { popover: { title: 'Connector Actions — the full menu', description: 'A live, searchable list of every single thing your connected apps can do, with the details each one needs. It’s the complete reference behind the friendly “Use now” screens.' } },
      { popover: { title: 'Try one right here', description: 'Find an action, fill in its fields, and run it on the spot — a quick way to see exactly what an app can do before you build a skill around it.' } },
      outro('For everyday use, the “Use now” button on a connector is friendlier — this is the power-user index.'),
    ],
  },

  '/data-mapping': {
    key: 'data-mapping',
    steps: [
      { popover: { title: 'Data Mapping (coming soon)', description: 'Soon you’ll be able to keep two apps in sync — e.g. a Zendesk ticket automatically becomes a ServiceNow incident with the right fields lined up. Orbit will propose the mapping and preview it against a real record before anything runs. This page previews what’s on the way.' } },
      outro('Nothing to set up yet — check back soon.'),
    ],
  },
}

// Tours for dynamic connector routes (built here so getTour can return them for
// any connection id).
const CONNECTOR_DETAIL_TOUR: Tour = {
  key: 'connector-detail',
  steps: [
    { popover: { title: 'Your connected app', description: 'This is the home page for one connected app. From here you can use it, see it working live, review everything it can do, and (for admins) control what it’s allowed to do.' } },
    { element: '[data-tour="conn-use"]', popover: { title: 'Three ways to use it', description: 'Start here. “Use it now” is a point-and-click screen to run things and get answers. “Ask in plain English” opens the Assistant. “See past answers” takes you to your saved results. No code in any of them.', side: 'bottom' } },
    { element: '[data-tour="conn-livedata"]', popover: { title: 'Proof it’s working', description: 'These are real read-only results fetched the moment the page loaded — a live sign that the connection is healthy and pulling data.', side: 'top' } },
    { element: '[data-tour="conn-actions"]', popover: { title: 'Everything it can do', description: 'The full menu of what this app can do, grouped by topic and searchable. The shortcuts cover common tasks — and OrbitAPI can reach the app’s entire API when you ask, including older data the app’s own screens hide.', side: 'top' } },
    { element: '[data-tour="conn-access"]', popover: { title: 'Guardrails (admins)', description: 'Limit what this connection may do — allow only reads, or block deletes — and every setting is enforced everywhere: chat, skills, and playbooks. Safety you set once.', side: 'top' } },
    outro('Next: click “Use it now” at the top to run your first action with a simple form.'),
  ],
}

const USE_NOW_TOUR: Tour = {
  key: 'use-now',
  steps: [
    { popover: { title: 'Use it now — no code, promise', description: 'This is the heart of OrbitAPI for beginners. You’re about to “call an API” — which just means: pick something to do, fill in a couple blanks, and get an answer back. Let’s walk through it.' } },
    { element: '[data-tour="run-picker"]', popover: { title: '1. Pick what you want to do', description: 'Everything this app can do, in plain language, grouped as “Get info” (just looking things up — always safe), “Make a change,” and “Delete.” Search if the list is long. Click one to select it.', side: 'right' } },
    { element: '[data-tour="run-form"]', popover: { title: '2. Fill in the blanks', description: 'Your choice shows a simple form — labeled fields, dropdowns for set choices, with “required” marked. No JSON, no syntax. Fill it in and press Run. Changes and deletes ask you to confirm first.', side: 'left' } },
    { element: '[data-tour="run-form"]', popover: { title: '3. Read it and save it', description: 'The answer comes back as a clean table. One click exports it to Excel, CSV, PDF, or Word — so “get me March–May’s tickets” becomes a spreadsheet you can actually use.', side: 'left' } },
    { element: '[data-tour="run-advanced"]', popover: { title: 'Advanced is optional', description: 'If you ever want to write raw requests, “Advanced (code)” is here for developers. You never need it — the simple form does everything.', side: 'bottom', align: 'end' } },
    outro('That’s a real API call, done with a form. Try one now — a “Get info” action is the safest place to start.'),
  ],
}

const CHAT_TOUR: Tour = {
  key: 'chat',
  steps: [
    { popover: { title: 'Orbit Assistant — just ask', description: 'This is the easiest way to use your apps: type what you want in plain English and Orbit does the API work behind the scenes. “How many bookings this week?” “Email a summary to the team.” No commands to memorize.' } },
    { element: '[data-tour="chat-suggestions"]', popover: { title: 'Not sure what to type?', description: 'These starter prompts are tailored to the apps you’ve connected. Click one to try it — they’re a great way to see what’s possible.', side: 'top' } },
    { element: '[data-tour="chat-input"]', popover: { title: 'Ask anything', description: 'Type here and hit Send. Orbit figures out which apps and actions it needs, runs the read-only ones instantly, and pauses for your approval before anything that changes data.', side: 'top' } },
    { element: '[data-tour="chat-context"]', popover: { title: 'Focus it on one job', description: 'Leave this on “General” to use everything you’ve connected, or pick a Skill to scope the chat to that skill’s instructions and apps. Optional — General is fine to start.', side: 'bottom' } },
    { element: '[data-tour="chat-aipower"]', popover: { title: 'What each answer costs', description: 'Each reply uses a little AI Power — this meter shows what’s left so there are never surprises.', side: 'bottom', align: 'end' } },
    { element: '[data-tour="chat-saveskill"]', popover: { title: 'Turn a good chat into a Skill', description: 'Found a useful back-and-forth? After a couple messages, “Save as reusable skill” turns it into a helper you can re-run any time — this is how a one-off question becomes an automation.', side: 'top', align: 'end' } },
    outro('Next: click a suggestion or ask your own question — and export the answer if it’s a keeper.'),
  ],
}

// Resolve the tour for a pathname. Dynamic connector routes are matched first,
// then the longest literal-prefix match wins.
export function getTour(pathname: string): Tour | null {
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return CHAT_TOUR
  // /connectors/<id>/manual  → the hands-on "Use now" runner
  if (/^\/connectors\/[^/]+\/manual\/?$/.test(pathname)) return USE_NOW_TOUR
  // /connectors/<id>  → a single connection's detail page (exclude literal sub-pages)
  const m = pathname.match(/^\/connectors\/([^/]+)\/?$/)
  if (m && !['discover', 'requests', 'trash'].includes(m[1])) return CONNECTOR_DETAIL_TOUR

  const keys = Object.keys(TOURS).sort((a, b) => b.length - a.length)
  for (const route of keys) {
    if (pathname === route || pathname.startsWith(route + '/')) return TOURS[route]
  }
  return null
}

// Interactive product-tour definitions, one per major page. Each step either
// targets a real element by its `data-tour="..."` attribute (spotlight + tooltip)
// or omits `element` to show a centered intro/outro card.
//
// Driver.js consumes these (see components/page-tour.tsx). Adding a new tour:
//   1. add a `data-tour="x"` attribute to the real element(s) on the page
//   2. add an entry here keyed by the route
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

// A closing step reused by every tour — points people at the persistent help.
const HELP_OUTRO: TourStep = {
  popover: {
    title: "That's the tour!",
    description:
      'Re-run it any time with “Show me around” at the top. For anything else, the Orbit Assistant (bottom-right) answers questions in plain English.',
  },
}

const TOURS: Record<string, Tour> = {
  '/dashboard': {
    key: 'dashboard',
    steps: [
      { popover: { title: 'Welcome to OrbitAPI 👋', description: 'A 30-second tour of your home base. OrbitAPI lets you run and automate your apps’ APIs in plain English — no code.' } },
      { element: '[data-tour="dash-stats"]', popover: { title: 'Your numbers at a glance', description: 'Connected apps, actions today, active skills, and API calls this month. Each card links to the full view.', side: 'bottom' } },
      { element: '[data-tour="dash-getstarted"]', popover: { title: 'Get started checklist', description: 'Five steps that build on each other — connect an app, ask the Assistant, save a skill, group connectors, automate. It tracks itself and disappears when you’re done.', side: 'top' } },
      { element: '[data-tour="dash-assistant"]', popover: { title: 'Orbit Assistant', description: 'Jump into a chat to ask questions or run actions across your connected apps.', side: 'bottom', align: 'end' } },
      { element: '[data-tour="sidebar-nav"]', popover: { title: 'Everything lives here', description: 'Navigate sections from the sidebar — grouped as Connect, Automate, Operate, and Insights.', side: 'right' } },
      HELP_OUTRO,
    ],
  },

  '/connectors': {
    key: 'connectors',
    steps: [
      { popover: { title: 'API Connectors', description: 'A connector is a ready-made link to an app’s API. This is the foundation — everything else acts through what you connect here.' } },
      { element: '[data-tour="connector-search"]', popover: { title: 'Find an app', description: 'Search 100+ connectors by name, category, or what they do.', side: 'bottom' } },
      { element: '[data-tour="connector-catalog"]', popover: { title: 'Connect or Simulate', description: 'Each card has two options: “Connect” (enter real API keys) or “Simulate” (try it instantly with realistic fake data — no keys needed). Simulate is the fastest way to explore.', side: 'top' } },
      HELP_OUTRO,
    ],
  },

  '/groups': {
    key: 'groups',
    steps: [
      { popover: { title: 'Groups', description: 'A group bundles related connections so an agent only touches the right apps — e.g. a “Finance” group with just NetSuite and Slack.' } },
      { element: '[data-tour="group-create"]', popover: { title: 'Create a group', description: 'Name a group and add connections to it. Skills can then be scoped to a single group.', side: 'bottom' } },
      HELP_OUTRO,
    ],
  },

  '/skills': {
    key: 'skills',
    steps: [
      { popover: { title: 'Skills', description: 'A Skill is a reusable AI agent with a persona and a job — “check for large invoices and alert me”. It acts through your connectors.' } },
      { element: '[data-tour="skill-create"]', popover: { title: 'Create a skill', description: 'Give it a name, choose which connectors it can use, then set its persona and how it runs (manual, scheduled, or autonomous).', side: 'bottom' } },
      { element: '[data-tour="skill-templates"]', popover: { title: 'Start from a template', description: 'Not sure where to begin? Pick a ready-made skill template and tweak it.', side: 'top' } },
      HELP_OUTRO,
    ],
  },

  '/playbooks': {
    key: 'playbooks',
    steps: [
      { popover: { title: 'Playbooks', description: 'A Playbook orchestrates multiple steps and actions across connectors with conditional branching and approval chains — ideal for incident response and runbooks.' } },
      { element: '[data-tour="playbook-create"]', popover: { title: 'Build a playbook', description: 'Start from a template or scratch, then wire up steps: assess, act, branch, request approval, notify, or wait.', side: 'bottom' } },
      HELP_OUTRO,
    ],
  },

  '/bundles': {
    key: 'bundles',
    steps: [
      { popover: { title: 'Bundles', description: 'A Bundle is a ready-made pack of connectors, skills, and playbooks for a use case — install a working setup in one click.' } },
      { element: '[data-tour="bundles-list"]', popover: { title: 'Install a bundle', description: 'Browse vertical bundles and install one to get connectors, groups, skills, and playbooks pre-wired.', side: 'top' } },
      HELP_OUTRO,
    ],
  },

  '/data-mapping': {
    key: 'data-mapping',
    steps: [
      { popover: { title: 'Data Mapping (coming soon)', description: 'Soon you’ll be able to translate fields from one connector into another — e.g. a Zendesk ticket becomes a ServiceNow incident with the right fields. This page previews what’s on the way.' } },
      HELP_OUTRO,
    ],
  },

  '/webhooks': {
    key: 'webhooks',
    steps: [
      { popover: { title: 'Webhooks', description: 'Let outside apps trigger your automations in real time via a secure, signed URL — no polling.' } },
      { element: '[data-tour="webhooks"]', popover: { title: 'Create an endpoint', description: 'Generate a URL + signing secret, point an external service at it, and choose which skill or playbook it fires. Every delivery is logged and replay-testable.', side: 'top' } },
      HELP_OUTRO,
    ],
  },

  '/approvals': {
    key: 'approvals',
    steps: [
      { popover: { title: 'Approvals', description: 'The safety gate. When a skill wants to write or delete something, it pauses here for your sign-off before anything happens.' } },
      { element: '[data-tour="approvals-legend"]', popover: { title: 'Read / Write / Destructive', description: 'Reads run freely; writes and destructive actions need approval — destructive ones also require a rollback plan.', side: 'bottom' } },
      { element: '[data-tour="approvals-filter"]', popover: { title: 'Pending vs history', description: 'Switch between actions awaiting your decision and the full history of what’s been approved or rejected.', side: 'bottom' } },
      HELP_OUTRO,
    ],
  },

  '/usage': {
    key: 'usage',
    steps: [
      { popover: { title: 'Usage', description: 'See how much you’re using OrbitAPI — API calls, skill runs, errors, and which connectors are busiest.' } },
      { element: '[data-tour="usage-range"]', popover: { title: 'Pick a date range', description: 'Preset windows or a custom range. The whole report updates to match.', side: 'bottom' } },
      { element: '[data-tour="usage-export"]', popover: { title: 'Export a report', description: 'Export a clean PDF of the current range — handy for sharing with your team or stakeholders.', side: 'bottom', align: 'end' } },
      HELP_OUTRO,
    ],
  },
}

// Resolve the tour for a pathname (longest matching route prefix wins so
// e.g. /connectors/discover still gets the connectors tour).
export function getTour(pathname: string): Tour | null {
  const keys = Object.keys(TOURS).sort((a, b) => b.length - a.length)
  for (const route of keys) {
    if (pathname === route || pathname.startsWith(route + '/')) return TOURS[route]
  }
  return null
}

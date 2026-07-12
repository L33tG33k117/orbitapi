// Curated public changelog. Every entry corresponds to features actually
// shipped (dates from git history) — add a new entry at the TOP when a
// user-visible feature ships. Marketing tone, but never claim what isn't live.

export interface ChangelogEntry {
  date: string // ISO date
  title: string
  tag: 'New' | 'Improved' | 'Foundation'
  points: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-12',
    title: 'Starlab history, smarter Slack errors, and fixes',
    tag: 'Improved',
    points: [
      'The Starlab orbit strip now keeps the last 7 days of launches — click any finished flight to jump to its results in Activity, and scroll sideways when the pad gets busy.',
      'Slack actions now accept #channel-names everywhere (not just when sending), and errors tell you what to actually do — like which OAuth scope the bot token is missing or that the bot needs a /invite.',
      'Fixed "connector not found" when creating a simulated connection for newer catalog apps like Microsoft Outlook.',
    ],
  },
  {
    date: '2026-07-12',
    title: 'Per-action permissions on every connection',
    tag: 'New',
    points: [
      'Admins can now set a permission on each individual action of a connection: Automatic (runs with no approval step), Manual approve (every automated use — assistant, skills, playbooks, external AI — queues for human approval), or Never (the action is disabled entirely).',
      'Set it right on the connector page, next to each action. Unset actions keep the standard behavior.',
      'Every policy change is recorded in the Audit trail.',
    ],
  },
  {
    date: '2026-07-12',
    title: 'Batch delete for connections',
    tag: 'Improved',
    points: [
      'Select multiple connections on the Connections page and remove them in one go — move to Trash or delete forever, same as single removals.',
      'Fixed an error that could block deleting a connection that had audit history.',
    ],
  },
  {
    date: '2026-07-02',
    title: '100+ integrations, and full-API access on every one',
    tag: 'New',
    points: [
      'The catalog jumped to 100+ connectable apps — GitHub, Stripe, Salesforce, HubSpot, Jira, Notion, Datadog, Okta, Snowflake, Guesty, and many more — each usable instantly in Simulated mode with no keys.',
      'Every connector now includes full-API access: the built-in shortcuts cover common tasks, but OrbitAPI can reach the app’s entire API on request — so you can pull all-time history and bulk data that the app’s own screens cap or hide.',
      'Curated actions are grouped by topic and searchable, so even big connectors stay easy to scan.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Connect your AI — OrbitAPI becomes an MCP server',
    tag: 'New',
    points: [
      'Claude, ChatGPT, and Cursor can now operate your workspace directly: your connectors become tools your AI assistant can call, with reads executing instantly and risky actions queuing for your approval.',
      'The welcome wizard now runs your first real AI mission during setup and shows you the report it wrote, live.',
      'New public integrations catalog, solutions pages, and this changelog.',
    ],
  },
  {
    date: '2026-07-01',
    title: 'Mission-control redesign',
    tag: 'Improved',
    points: [
      'The whole app moved to a floating mission-control shell with a new visual identity — every tab got a cleaner, faster layout.',
      'Keyboard-shortcut panel and command polish throughout.',
    ],
  },
  {
    date: '2026-06-26',
    title: 'Approval gates for skills',
    tag: 'New',
    points: [
      'Skills can now require human approval before any write or destructive action — the AI does the work, you keep the trigger.',
      'Skills can be scoped to specific connections, so an agent only ever sees the systems you hand it.',
    ],
  },
  {
    date: '2026-06-25',
    title: 'Simulated mode for every connector',
    tag: 'New',
    points: [
      'Every available connector now runs as a realistic, consistent sandbox — create tickets, query invoices, contain endpoints — with zero API keys and zero risk.',
      'New Activity hub unifies run outputs and history across skills, playbooks, and chat.',
    ],
  },
  {
    date: '2026-06-21',
    title: 'Guided setup, playbook canvas, and per-connector access control',
    tag: 'New',
    points: [
      'New guided welcome wizard takes you from signup to your first completed AI run in about a minute.',
      'Drag-and-drop canvas for building playbooks visually.',
      'Role-based access controls per connector and action risk, plus optional email reports after every skill run.',
    ],
  },
  {
    date: '2026-06-19',
    title: 'Bundles & Marketplace',
    tag: 'New',
    points: [
      'One-click bundles — Security SOC, Support Ops, Accountant, Threat Hunter, and more — install connectors, playbooks, and skills as a working unit, entirely in Simulated mode if you choose.',
      'The bundle builder reuses connections you already have and lets you substitute vendors (e.g. Sophos instead of CrowdStrike).',
    ],
  },
  {
    date: '2026-06-11',
    title: 'Liftoff',
    tag: 'Foundation',
    points: [
      'OrbitAPI is born: workspaces with role-based access, the connector framework, the first connectors, and the Orbit Assistant.',
    ],
  },
]

import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function teamsPost(webhookUrl: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `Teams webhook ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: { status: 'sent' } }
}

const LEVEL_COLORS: Record<string, string> = {
  good: '00b050',
  warning: 'ffb900',
  danger: 'd13438',
  info: '0078d4',
}

export const teamsManifest: ConnectorManifest = {
  slug: 'teams',
  name: 'Microsoft Teams',
  category: 'Communication',
  description: 'Post messages, adaptive cards, fact sheets, tables, and image cards to Teams channels via Incoming Webhook.',
  logoUrl: '/logos/teams.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Webhook URL',
    keyPlaceholder: 'https://yourorg.webhook.office.com/webhookb2/...',
    keyHint: 'In Teams: channel → ⋯ → Connectors → Incoming Webhook → Configure → copy URL.',
    setupGuide: [
      {
        title: 'Add an Incoming Webhook to your Teams channel',
        description:
          'In Teams, open the channel, click **⋯ → Connectors → Incoming Webhook → Configure**. ' +
          'Name it "OrbitAPI" and click **Create**.',
      },
      {
        title: 'Copy the webhook URL',
        description:
          'Copy the full webhook URL and paste it below. The URL starts with https://your-org.webhook.office.com/...',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await teamsPost(creds.api_key, {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      text: '✅ OrbitAPI connection test successful.',
    })
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: 'Microsoft Teams webhook connected' }
  },

  network: { hostPattern: '<your-org>.webhook.office.com' },

  actions: [
    {
      slug: 'send_message',
      name: 'Send Message',
      description:
        'Post a plain text message to the Teams channel. Markdown is supported in most Teams clients.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'Message text (Markdown supported)' },
          title: { type: 'string', description: 'Optional message title (displayed bold above text)' },
        },
      },
      execute: async (creds, params) => {
        const card: Record<string, unknown> = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          text: params.text,
        }
        if (params.title) card.title = params.title
        return teamsPost(creds.api_key, card)
      },
    },
    {
      slug: 'send_alert',
      name: 'Send Alert Card',
      description:
        'Post a formatted alert card with a coloured header, title, and body. ' +
        'level: info, good, warning, or danger. Optionally include an action button.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'body', 'level'],
        properties: {
          title: { type: 'string', description: 'Alert title' },
          body: { type: 'string', description: 'Alert body text' },
          level: { type: 'string', enum: ['info', 'good', 'warning', 'danger'] },
          action_url: { type: 'string', description: 'Optional link button URL' },
          action_label: { type: 'string', description: 'Optional link button label' },
        },
      },
      execute: async (creds, params) => {
        const color = LEVEL_COLORS[(params.level as string)] ?? LEVEL_COLORS.info
        const card: Record<string, unknown> = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: color,
          summary: params.title,
          sections: [{
            activityTitle: `**${params.title}**`,
            activityText: params.body,
          }],
        }
        if (params.action_url) {
          card.potentialAction = [{
            '@type': 'OpenUri',
            name: params.action_label ?? 'View details',
            targets: [{ os: 'default', uri: params.action_url }],
          }]
        }
        return teamsPost(creds.api_key, card)
      },
    },
    {
      slug: 'send_facts_card',
      name: 'Send Facts Card',
      description:
        'Post a card with a title and a list of key-value "facts". ' +
        'facts is a JSON string: {"Key1":"Value1","Key2":"Value2"}. ' +
        'Ideal for structured status updates and summaries.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'facts'],
        properties: {
          title: { type: 'string', description: 'Card title' },
          facts: { type: 'string', description: 'JSON object of key-value pairs (e.g. {"Status":"Active","Host":"WIN-001","IP":"192.168.1.1"})' },
          color: { type: 'string', description: 'Header accent color (hex without #, default: 0078d4)' },
          body: { type: 'string', description: 'Optional body text above the facts (optional)' },
          action_url: { type: 'string', description: 'Optional action button URL (optional)' },
          action_label: { type: 'string', description: 'Optional action button label (optional)' },
        },
      },
      execute: async (creds, params) => {
        let factsObj: Record<string, string> = {}
        try { factsObj = JSON.parse(params.facts as string) } catch { factsObj = {} }
        const facts = Object.entries(factsObj).map(([name, value]) => ({ name, value }))
        const section: Record<string, unknown> = { activityTitle: `**${params.title}**`, facts }
        if (params.body) section.activityText = params.body
        const card: Record<string, unknown> = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: (params.color as string | undefined) ?? '0078d4',
          summary: params.title,
          sections: [section],
        }
        if (params.action_url) {
          card.potentialAction = [{
            '@type': 'OpenUri',
            name: params.action_label ?? 'View',
            targets: [{ os: 'default', uri: params.action_url }],
          }]
        }
        return teamsPost(creds.api_key, card)
      },
    },
    {
      slug: 'send_table_card',
      name: 'Send Table Card',
      description:
        'Post a card with a formatted data table. ' +
        'headers is a comma-separated list of column headers. ' +
        'rows is a JSON array of arrays (each inner array is one row of values).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'headers', 'rows'],
        properties: {
          title: { type: 'string', description: 'Table title' },
          headers: { type: 'string', description: 'Comma-separated column headers (e.g. "Host,Status,Risk Score")' },
          rows: { type: 'string', description: 'JSON array of row arrays (e.g. [["WIN-001","Active","High"],["MAC-002","Isolated","Critical"]])' },
          color: { type: 'string', description: 'Accent color hex (without #, default: 0078d4)' },
        },
      },
      execute: async (creds, params) => {
        const headers = (params.headers as string).split(',').map(h => h.trim())
        let rows: string[][] = []
        try { rows = JSON.parse(params.rows as string) } catch { rows = [] }
        const headerRow = headers.map(h => `**${h}**`).join(' | ')
        const dividerRow = headers.map(() => '---').join(' | ')
        const bodyRows = rows.map(row => row.map(c => String(c)).join(' | '))
        const tableText = [headerRow, dividerRow, ...bodyRows].join('\n')
        return teamsPost(creds.api_key, {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: (params.color as string | undefined) ?? '0078d4',
          summary: params.title,
          sections: [{
            activityTitle: `**${params.title}**`,
            activityText: tableText,
          }],
        })
      },
    },
    {
      slug: 'send_action_card',
      name: 'Send Action Card',
      description:
        'Post a card with multiple action buttons (links). Each button opens a URL. ' +
        'buttons is a JSON array: [{"label":"Open Dashboard","url":"https://..."},{"label":"View Alert","url":"https://..."}].',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'body', 'buttons'],
        properties: {
          title: { type: 'string', description: 'Card title' },
          body: { type: 'string', description: 'Card body text' },
          buttons: { type: 'string', description: 'JSON array of {label, url} objects' },
          color: { type: 'string', description: 'Accent color hex (without #, optional)' },
        },
      },
      execute: async (creds, params) => {
        let buttons: { label: string; url: string }[] = []
        try { buttons = JSON.parse(params.buttons as string) } catch { buttons = [] }
        return teamsPost(creds.api_key, {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: (params.color as string | undefined) ?? '0078d4',
          summary: params.title,
          sections: [{
            activityTitle: `**${params.title}**`,
            activityText: params.body,
          }],
          potentialAction: buttons.map(b => ({
            '@type': 'OpenUri',
            name: b.label,
            targets: [{ os: 'default', uri: b.url }],
          })),
        })
      },
    },
    {
      slug: 'send_image_card',
      name: 'Send Image Card',
      description:
        'Post a card with an image, title, and body text. ' +
        'image_url must be a publicly accessible image URL.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'image_url'],
        properties: {
          title: { type: 'string', description: 'Card title' },
          image_url: { type: 'string', description: 'Publicly accessible image URL' },
          body: { type: 'string', description: 'Caption or body text (optional)' },
          action_url: { type: 'string', description: 'Link when image is clicked (optional)' },
        },
      },
      execute: async (creds, params) => {
        const section: Record<string, unknown> = {
          activityTitle: `**${params.title}**`,
          activityImage: params.image_url,
        }
        if (params.body) section.activityText = params.body
        const card: Record<string, unknown> = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: params.title,
          sections: [section],
        }
        if (params.action_url) {
          card.potentialAction = [{
            '@type': 'OpenUri',
            name: 'View',
            targets: [{ os: 'default', uri: params.action_url }],
          }]
        }
        return teamsPost(creds.api_key, card)
      },
    },
    {
      slug: 'send_digest',
      name: 'Send Digest',
      description:
        'Post a multi-section digest card summarizing multiple items. ' +
        'sections is a JSON array: [{"title":"Section A","body":"Content A"},{"title":"Section B","body":"Content B"}].',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'sections'],
        properties: {
          title: { type: 'string', description: 'Digest card title' },
          sections: { type: 'string', description: 'JSON array of {title, body} sections' },
          color: { type: 'string', description: 'Accent color hex (without #, default: 0078d4)' },
          footer: { type: 'string', description: 'Footer text (optional)' },
        },
      },
      execute: async (creds, params) => {
        let sectionsData: { title: string; body: string }[] = []
        try { sectionsData = JSON.parse(params.sections as string) } catch { sectionsData = [] }
        const cardSections: Record<string, unknown>[] = sectionsData.map(s => ({
          activityTitle: `**${s.title}**`,
          activityText: s.body,
        }))
        if (params.footer) {
          cardSections.push({ activityText: `*${params.footer}*` })
        }
        return teamsPost(creds.api_key, {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: (params.color as string | undefined) ?? '0078d4',
          summary: params.title,
          title: params.title,
          sections: cardSections,
        })
      },
    },
    {
      slug: 'send_incident_card',
      name: 'Send Incident Card',
      description:
        'Post a pre-formatted incident notification card with severity colour coding and structured metadata. ' +
        'severity: critical, high, medium, low.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['incident_id', 'title', 'severity'],
        properties: {
          incident_id: { type: 'string', description: 'Incident identifier (e.g. INC-001)' },
          title: { type: 'string', description: 'Incident summary title' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Incident severity' },
          description: { type: 'string', description: 'Incident description (optional)' },
          affected_system: { type: 'string', description: 'System or service affected (optional)' },
          assigned_to: { type: 'string', description: 'Person or team assigned (optional)' },
          dashboard_url: { type: 'string', description: 'Link to incident dashboard or runbook (optional)' },
        },
      },
      execute: async (creds, params) => {
        const severityColors: Record<string, string> = {
          critical: 'd13438', high: 'ff8c00', medium: 'ffb900', low: '0078d4',
        }
        const color = severityColors[(params.severity as string)] ?? '0078d4'
        const facts: { name: string; value: string }[] = [
          { name: 'Incident ID', value: params.incident_id as string },
          { name: 'Severity', value: (params.severity as string).toUpperCase() },
        ]
        if (params.affected_system) facts.push({ name: 'Affected System', value: params.affected_system as string })
        if (params.assigned_to) facts.push({ name: 'Assigned To', value: params.assigned_to as string })
        facts.push({ name: 'Reported At', value: new Date().toUTCString() })
        const card: Record<string, unknown> = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: color,
          summary: `Incident: ${params.title}`,
          sections: [{
            activityTitle: `🚨 **${params.title}**`,
            activityText: (params.description as string | undefined) ?? '',
            facts,
          }],
        }
        if (params.dashboard_url) {
          card.potentialAction = [{
            '@type': 'OpenUri',
            name: 'View Incident',
            targets: [{ os: 'default', uri: params.dashboard_url }],
          }]
        }
        return teamsPost(creds.api_key, card)
      },
    },
  ],
}

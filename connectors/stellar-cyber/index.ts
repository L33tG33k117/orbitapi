import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function getStarLightToken(host: string, username: string, apiKey: string): Promise<string> {
  const base = host.replace(/\/$/, '')
  const res = await fetch(`${base}/connect/api/v1/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, api_key: apiKey }),
  })
  if (!res.ok) throw new Error(`Stellar Cyber auth failed: ${res.status} ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.access_token as string
}

async function scGet(host: string, token: string, path: string): Promise<ActionResult> {
  const base = host.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Stellar Cyber ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function scPost(host: string, token: string, path: string, body: unknown): Promise<ActionResult> {
  const base = host.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Stellar Cyber ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function scPatch(host: string, token: string, path: string, body: unknown): Promise<ActionResult> {
  const base = host.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Stellar Cyber ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

export const stellarCyberManifest: ConnectorManifest = {
  slug: 'stellar-cyber',
  name: 'Stellar Cyber',
  category: 'Security',
  description: 'Open XDR SIEM — AI threat detection, cases, alerts, event search, sensors, threat intelligence, and automated response.',
  logoUrl: '/logos/stellar-cyber.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Key',
    keyPlaceholder: 'Stellar Cyber API key',
    fields: [
      { key: 'host', label: 'StarLight Host', placeholder: 'https://your-instance.stellarcyber.cloud', inputType: 'text' },
      { key: 'username', label: 'Username', placeholder: 'Your Stellar Cyber username', inputType: 'text' },
      { key: 'api_key', label: 'API Key', placeholder: 'Stellar Cyber API key', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Find your StarLight host URL',
        description:
          'Your Stellar Cyber console URL is the StarLight host. Include the full https:// prefix.',
      },
      {
        title: 'Generate an API key',
        description:
          'Log into Stellar Cyber as admin. Go to **System → Users → your user → API Key**. Generate or copy your API key.',
      },
    ],
  },

  testConnection: async (creds) => {
    try {
      const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
      const res = await scGet(creds.host, token, '/connect/api/v1/alerts?size=1')
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, label: `Stellar Cyber ${creds.host}` }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  network: { hostPattern: '<your-instance>.stellarcyber.cloud' },

  actions: [
    {
      slug: 'list_alerts',
      name: 'List Alerts',
      description:
        'List Stellar Cyber XDR alerts. Filter by severity: low, medium, high, critical. ' +
        'Filter by status: new, in_progress, closed. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Filter: low, medium, high, critical' },
          status: { type: 'string', description: 'Filter: new, in_progress, closed' },
          limit: { type: 'number', description: 'Max alerts (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`size=${limit}`, 'sort_by=created_at&sort_order=desc']
          if (params.severity) qs.push(`severity=${params.severity}`)
          if (params.status) qs.push(`status=${params.status}`)
          return scGet(creds.host, token, `/connect/api/v1/alerts?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_alert',
      name: 'Get Alert',
      description: 'Get full details of a single Stellar Cyber alert by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['alert_id'],
        properties: {
          alert_id: { type: 'string', description: 'Stellar Cyber alert ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          return scGet(creds.host, token, `/connect/api/v1/alerts/${params.alert_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'update_alert_status',
      name: 'Update Alert Status',
      description: 'Update the status and optionally add a comment to a Stellar Cyber alert.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['alert_id', 'status'],
        properties: {
          alert_id: { type: 'string', description: 'Stellar Cyber alert ID' },
          status: { type: 'string', enum: ['new', 'in_progress', 'closed'], description: 'New alert status' },
          comment: { type: 'string', description: 'Comment to add (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const body: Record<string, unknown> = { status: params.status }
          if (params.comment) body.comment = params.comment
          return scPatch(creds.host, token, `/connect/api/v1/alerts/${params.alert_id as string}`, body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_cases',
      name: 'List Cases',
      description:
        'List Stellar Cyber security cases (grouped investigations). ' +
        'Filter by status: open, in_progress, closed. priority: low, medium, high, critical.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter: open, in_progress, closed' },
          priority: { type: 'string', description: 'Filter: low, medium, high, critical' },
          limit: { type: 'number', description: 'Max cases (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`size=${limit}`, 'sort_by=created_at&sort_order=desc']
          if (params.status) qs.push(`status=${params.status}`)
          if (params.priority) qs.push(`priority=${params.priority}`)
          return scGet(creds.host, token, `/connect/api/v1/cases?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_case',
      name: 'Get Case',
      description: 'Get full details of a Stellar Cyber case including linked alerts and timeline.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['case_id'],
        properties: {
          case_id: { type: 'string', description: 'Stellar Cyber case ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          return scGet(creds.host, token, `/connect/api/v1/cases/${params.case_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'create_case',
      name: 'Create Case',
      description: 'Create a new Stellar Cyber investigation case. priority: low, medium, high, critical.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['title', 'priority'],
        properties: {
          title: { type: 'string', description: 'Case title' },
          description: { type: 'string', description: 'Case description (optional)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Case priority' },
          assignee: { type: 'string', description: 'Username to assign the case to (optional)' },
          alert_ids: { type: 'string', description: 'Comma-separated alert IDs to link to this case (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const body: Record<string, unknown> = {
            title: params.title,
            priority: params.priority,
          }
          if (params.description) body.description = params.description
          if (params.assignee) body.assignee = params.assignee
          if (params.alert_ids) body.alert_ids = (params.alert_ids as string).split(',').map(id => id.trim())
          return scPost(creds.host, token, '/connect/api/v1/cases', body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'update_case',
      name: 'Update Case',
      description:
        'Update a Stellar Cyber case — change status, priority, assignee, or add a comment. ' +
        'status: open, in_progress, closed. priority: low, medium, high, critical.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['case_id'],
        properties: {
          case_id: { type: 'string', description: 'Stellar Cyber case ID to update' },
          status: { type: 'string', enum: ['open', 'in_progress', 'closed'], description: 'New case status' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'New priority' },
          assignee: { type: 'string', description: 'Username to assign the case to' },
          comment: { type: 'string', description: 'Comment to add to the case' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const { case_id, comment, ...fields } = params
          const body: Record<string, unknown> = { ...fields }
          if (comment) body.comment = comment
          return scPatch(creds.host, token, `/connect/api/v1/cases/${case_id as string}`, body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'close_case',
      name: 'Close Case',
      description: 'Close a Stellar Cyber case with a resolution comment.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['case_id'],
        properties: {
          case_id: { type: 'string', description: 'Stellar Cyber case ID to close' },
          resolution: { type: 'string', description: 'Resolution summary or closing comment (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const body: Record<string, unknown> = { status: 'closed' }
          if (params.resolution) body.comment = params.resolution
          return scPatch(creds.host, token, `/connect/api/v1/cases/${params.case_id as string}`, body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'add_case_comment',
      name: 'Add Case Comment',
      description: 'Add a comment/note to an existing Stellar Cyber case.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['case_id', 'comment'],
        properties: {
          case_id: { type: 'string', description: 'Stellar Cyber case ID' },
          comment: { type: 'string', description: 'Comment text to add' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          return scPost(creds.host, token, `/connect/api/v1/cases/${params.case_id as string}/comments`, {
            text: params.comment,
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'search_events',
      name: 'Search Events',
      description:
        'Search raw security events in Stellar Cyber using a Lucene-style query. ' +
        'Examples: "event_type:dns AND src_ip:10.0.0.1", "event_type:alert AND score:[80 TO 100]". ' +
        'time_range_hours defaults to 24.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Lucene-style search query' },
          time_range_hours: { type: 'number', description: 'Look back N hours (default 24, max 168)' },
          limit: { type: 'number', description: 'Max events (default 50, max 200)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const hours = Math.min((params.time_range_hours as number | undefined) ?? 24, 168)
          const limit = Math.min((params.limit as number | undefined) ?? 50, 200)
          const now = Date.now()
          return scPost(creds.host, token, '/connect/api/v1/event-search', {
            query: params.query,
            from: new Date(now - hours * 3600 * 1000).toISOString(),
            to: new Date(now).toISOString(),
            size: limit,
            sort_by: 'timestamp',
            sort_order: 'desc',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_sensors',
      name: 'List Sensors',
      description: 'List data collection sensors (connectors, network taps) configured in Stellar Cyber.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max sensors (default 25)' },
          status: { type: 'string', description: 'Filter by status: online, offline, error (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`size=${limit}`]
          if (params.status) qs.push(`status=${params.status}`)
          return scGet(creds.host, token, `/connect/api/v1/sensors?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_sensor',
      name: 'Get Sensor',
      description: 'Get status and configuration details of a specific Stellar Cyber sensor.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['sensor_id'],
        properties: {
          sensor_id: { type: 'string', description: 'Stellar Cyber sensor ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          return scGet(creds.host, token, `/connect/api/v1/sensors/${params.sensor_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'create_alert_exception',
      name: 'Create Alert Exception',
      description:
        'Create an alert suppression rule to prevent specific alerts from being generated. ' +
        'Use to reduce false positives from known-safe activity.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name', 'filter'],
        properties: {
          name: { type: 'string', description: 'Name for this exception rule' },
          filter: { type: 'string', description: 'Lucene-style filter expression for alerts to suppress (e.g. "alert_name:port_scan AND src_ip:10.0.0.5")' },
          description: { type: 'string', description: 'Reason for the exception (optional)' },
          expiration_date: { type: 'string', description: 'ISO 8601 date when exception expires (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const body: Record<string, unknown> = {
            name: params.name,
            filter: params.filter,
          }
          if (params.description) body.description = params.description
          if (params.expiration_date) body.expiration_date = params.expiration_date
          return scPost(creds.host, token, '/connect/api/v1/alert-exceptions', body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'run_threat_hunt',
      name: 'Run Threat Hunt',
      description:
        'Execute a threat hunt query against Stellar Cyber\'s event data lake. ' +
        'Returns matching events for analysis. query uses Lucene syntax.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Threat hunt query (Lucene syntax, e.g. "user_name:admin AND event_type:login_failed")' },
          time_range_hours: { type: 'number', description: 'Hours to look back (default 72, max 720 = 30 days)' },
          limit: { type: 'number', description: 'Max events to return (default 100, max 500)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const hours = Math.min((params.time_range_hours as number | undefined) ?? 72, 720)
          const limit = Math.min((params.limit as number | undefined) ?? 100, 500)
          const now = Date.now()
          return scPost(creds.host, token, '/connect/api/v1/event-search', {
            query: params.query,
            from: new Date(now - hours * 3600 * 1000).toISOString(),
            to: new Date(now).toISOString(),
            size: limit,
            sort_by: 'timestamp',
            sort_order: 'desc',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_threat_intelligence',
      name: 'List Threat Intelligence',
      description: 'List threat intelligence indicators (IOCs) stored in the Stellar Cyber platform.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by indicator type: ip, domain, url, hash (optional)' },
          limit: { type: 'number', description: 'Max indicators (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getStarLightToken(creds.host, creds.username, creds.api_key)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`size=${limit}`]
          if (params.type) qs.push(`type=${params.type}`)
          return scGet(creds.host, token, `/connect/api/v1/threat-intelligence?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
  ],
}

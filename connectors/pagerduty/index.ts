import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const EVENTS_API = 'https://events.pagerduty.com/v2/enqueue'
const REST_API = 'https://api.pagerduty.com'

async function pdEvent(routingKey: string, body: Record<string, unknown>): Promise<ActionResult> {
  const res = await fetch(EVENTS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routing_key: routingKey, ...body }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `PagerDuty Events API ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function pdRest(apiKey: string, path: string, options: RequestInit = {}): Promise<ActionResult> {
  const res = await fetch(`${REST_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Token token=${apiKey}`,
      'Accept': 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `PagerDuty REST API ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

export const pagerdutyManifest: ConnectorManifest = {
  slug: 'pagerduty',
  name: 'PagerDuty',
  category: 'Incident Management',
  description: 'Trigger, acknowledge, and resolve incidents; list services, on-calls, schedules, escalation policies, and manage incidents via the PagerDuty API.',
  logoUrl: '/logos/pagerduty.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Integration Key (Routing Key)',
    keyPlaceholder: '32-character hex key',
    keyHint:
      'For triggering incidents: use an Events API v2 Integration Key (32-char hex) from Services → Integrations. ' +
      'For read operations (list services, on-calls, etc.): add a REST API User Token from My Profile → User Settings → Create API User Token.',
    fields: [
      {
        key: 'api_key',
        label: 'Integration Key (Events API)',
        placeholder: '32-character hex Integration Key',
        inputType: 'password',
      },
      {
        key: 'rest_token',
        label: 'REST API Token (for read operations)',
        placeholder: 'PagerDuty REST API User Token (optional)',
        inputType: 'password',
      },
    ],
    setupGuide: [
      {
        title: 'Get an Events API Integration Key',
        description:
          'In PagerDuty: **Services → Service Directory → your service → Integrations → Add integration → Events API v2**. ' +
          'Copy the 32-character Integration Key.',
      },
      {
        title: 'Get a REST API Token (optional, for read operations)',
        description:
          'In PagerDuty: click your avatar → **My Profile → User Settings → Create API User Token**. ' +
          'This token enables listing services, on-calls, schedules, users, and managing incidents by ID.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await pdEvent(creds.api_key, {
      event_action: 'trigger',
      dedup_key: 'orbitapi-connection-test',
      payload: {
        summary: 'OrbitAPI connection test — ignore',
        severity: 'info',
        source: 'orbitapi',
      },
    })
    if (!res.ok) return { ok: false, error: res.error }
    await pdEvent(creds.api_key, {
      event_action: 'resolve',
      dedup_key: 'orbitapi-connection-test',
    })
    return { ok: true, label: 'PagerDuty Events API connected' }
  },

  actions: [
    {
      slug: 'trigger_incident',
      name: 'Trigger Incident',
      description:
        'Create a new PagerDuty incident via the Events API. severity: critical, error, warning, info. ' +
        'dedup_key is optional — subsequent triggers with the same key update the existing incident.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['summary', 'severity'],
        properties: {
          summary: { type: 'string', description: 'One-line incident description' },
          severity: { type: 'string', enum: ['critical', 'error', 'warning', 'info'] },
          source: { type: 'string', description: 'Source system or device name (optional)' },
          dedup_key: { type: 'string', description: 'Unique key for deduplication (optional)' },
          details: { type: 'string', description: 'Additional context (optional)' },
        },
      },
      execute: async (creds, params) => {
        return pdEvent(creds.api_key, {
          event_action: 'trigger',
          dedup_key: (params.dedup_key as string | undefined) ?? undefined,
          payload: {
            summary: params.summary,
            severity: params.severity,
            source: (params.source as string | undefined) ?? 'OrbitAPI',
            custom_details: params.details ? { details: params.details } : undefined,
          },
        })
      },
    },
    {
      slug: 'resolve_incident',
      name: 'Resolve Incident',
      description: 'Resolve an existing PagerDuty incident by its dedup_key via the Events API.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['dedup_key'],
        properties: {
          dedup_key: { type: 'string', description: 'The dedup_key used when the incident was triggered' },
        },
      },
      execute: async (creds, params) => {
        return pdEvent(creds.api_key, { event_action: 'resolve', dedup_key: params.dedup_key })
      },
    },
    {
      slug: 'acknowledge_incident',
      name: 'Acknowledge Incident',
      description: 'Acknowledge a PagerDuty incident by its dedup_key — stops re-notifying on-call responders.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['dedup_key'],
        properties: {
          dedup_key: { type: 'string', description: 'The dedup_key of the incident to acknowledge' },
        },
      },
      execute: async (creds, params) => {
        return pdEvent(creds.api_key, { event_action: 'acknowledge', dedup_key: params.dedup_key })
      },
    },
    {
      slug: 'list_incidents',
      name: 'List Active Incidents',
      description:
        'List triggered or acknowledged PagerDuty incidents via the REST API. ' +
        'Requires a REST API Token in the "REST API Token" field above.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max incidents (default 10, max 25)' },
          status: { type: 'string', description: 'Filter by status: triggered, acknowledged, resolved (default: triggered,acknowledged)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 10, 25)
        const statuses = (params.status as string | undefined) ?? 'triggered,acknowledged'
        const qs = statuses.split(',').map(s => `statuses[]=${s.trim()}`).join('&')
        return pdRest(token, `/incidents?${qs}&limit=${limit}&sort_by=created_at:desc`)
      },
    },
    {
      slug: 'list_services',
      name: 'List Services',
      description:
        'List PagerDuty services (the things that generate alerts). Returns service ID, name, status, and escalation policy. ' +
        'Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max services (default 25, max 100)' },
          query: { type: 'string', description: 'Filter by service name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.query) qs.push(`query=${encodeURIComponent(params.query as string)}`)
        return pdRest(token, `/services?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_on_calls',
      name: 'List Who Is On-Call',
      description:
        'Show who is currently on-call for all escalation policies. ' +
        'Returns the on-call user, escalation policy, and schedule. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          escalation_policy_id: { type: 'string', description: 'Filter by specific escalation policy ID (optional)' },
          limit: { type: 'number', description: 'Max results (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.escalation_policy_id) qs.push(`escalation_policy_ids[]=${params.escalation_policy_id}`)
        return pdRest(token, `/oncalls?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_schedules',
      name: 'List Schedules',
      description:
        'List PagerDuty on-call schedules. Returns schedule ID, name, time zone, and current on-call user. ' +
        'Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max schedules (default 25)' },
          query: { type: 'string', description: 'Filter by schedule name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.query) qs.push(`query=${encodeURIComponent(params.query as string)}`)
        return pdRest(token, `/schedules?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_escalation_policies',
      name: 'List Escalation Policies',
      description: 'List PagerDuty escalation policies showing escalation rules and on-call users. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max policies (default 25)' },
          query: { type: 'string', description: 'Filter by policy name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.query) qs.push(`query=${encodeURIComponent(params.query as string)}`)
        return pdRest(token, `/escalation_policies?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_users',
      name: 'List Users',
      description: 'List PagerDuty users in your account. Returns user ID, name, email, and role. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max users (default 25)' },
          query: { type: 'string', description: 'Filter by name or email (optional)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.query) qs.push(`query=${encodeURIComponent(params.query as string)}`)
        return pdRest(token, `/users?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_teams',
      name: 'List Teams',
      description: 'List PagerDuty teams in your account. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max teams (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return pdRest(token, `/teams?limit=${limit}`)
      },
    },
    {
      slug: 'get_incident',
      name: 'Get Incident',
      description: 'Get details of a specific PagerDuty incident by its ID. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['incident_id'],
        properties: {
          incident_id: { type: 'string', description: 'PagerDuty incident ID (e.g. P3ZQXDF)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        return pdRest(token, `/incidents/${params.incident_id as string}`)
      },
    },
    {
      slug: 'manage_incident',
      name: 'Update Incident',
      description:
        'Update a PagerDuty incident by its incident ID. Change status (acknowledged, resolved), ' +
        'priority, urgency, or title. Requires a REST API Token.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['incident_id'],
        properties: {
          incident_id: { type: 'string', description: 'PagerDuty incident ID' },
          status: { type: 'string', enum: ['acknowledged', 'resolved'], description: 'New incident status' },
          title: { type: 'string', description: 'Updated incident title' },
          urgency: { type: 'string', enum: ['high', 'low'], description: 'Incident urgency' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const { incident_id, ...fields } = params
        return pdRest(token, `/incidents/${incident_id as string}`, {
          method: 'PUT',
          body: JSON.stringify({ incident: { type: 'incident', ...fields } }),
        })
      },
    },
    {
      slug: 'add_incident_note',
      name: 'Add Incident Note',
      description: 'Add a note/comment to an existing PagerDuty incident by its ID. Requires a REST API Token.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['incident_id', 'content'],
        properties: {
          incident_id: { type: 'string', description: 'PagerDuty incident ID' },
          content: { type: 'string', description: 'Note text to add to the incident' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        return pdRest(token, `/incidents/${params.incident_id as string}/notes`, {
          method: 'POST',
          body: JSON.stringify({ note: { content: params.content } }),
        })
      },
    },
    {
      slug: 'list_log_entries',
      name: 'List Incident Log Entries',
      description: 'List log entries (audit trail) for a specific PagerDuty incident. Requires a REST API Token.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['incident_id'],
        properties: {
          incident_id: { type: 'string', description: 'PagerDuty incident ID' },
          limit: { type: 'number', description: 'Max log entries (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return pdRest(token, `/incidents/${params.incident_id as string}/log_entries?limit=${limit}&is_overview=true`)
      },
    },
    {
      slug: 'create_override',
      name: 'Create Schedule Override',
      description:
        'Override a PagerDuty schedule to put a specific user on-call for a time window. ' +
        'start and end must be ISO 8601 datetimes (e.g. 2024-06-15T08:00:00Z). Requires a REST API Token.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['schedule_id', 'user_id', 'start', 'end'],
        properties: {
          schedule_id: { type: 'string', description: 'PagerDuty schedule ID' },
          user_id: { type: 'string', description: 'User ID to override with' },
          start: { type: 'string', description: 'Override start time (ISO 8601, e.g. 2024-06-15T08:00:00Z)' },
          end: { type: 'string', description: 'Override end time (ISO 8601)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        return pdRest(token, `/schedules/${params.schedule_id as string}/overrides`, {
          method: 'POST',
          body: JSON.stringify({
            override: {
              start: params.start,
              end: params.end,
              user: { id: params.user_id, type: 'user_reference' },
            },
          }),
        })
      },
    },
    {
      slug: 'snooze_incident',
      name: 'Snooze Incident',
      description:
        'Snooze a PagerDuty incident for a specified number of seconds. ' +
        'The incident will re-trigger after the snooze duration expires. Requires a REST API Token.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['incident_id', 'duration'],
        properties: {
          incident_id: { type: 'string', description: 'PagerDuty incident ID to snooze' },
          duration: { type: 'number', description: 'Snooze duration in seconds (e.g. 3600 = 1 hour)' },
        },
      },
      execute: async (creds, params) => {
        const token = creds.rest_token ?? creds.api_key
        return pdRest(token, `/incidents/${params.incident_id as string}/snooze`, {
          method: 'POST',
          body: JSON.stringify({ duration: params.duration }),
        })
      },
    },
  ],
}

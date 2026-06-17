import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const BASE = 'https://api.crowdstrike.com'

async function csGet(token: string, path: string): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!res.ok) return { ok: false, error: `CrowdStrike API ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: await res.json() }
}

async function csPost(token: string, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `CrowdStrike API ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: await res.json() }
}

async function csPatch(token: string, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `CrowdStrike API ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: await res.json() }
}

async function csDelete(token: string, path: string): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!res.ok) return { ok: false, error: `CrowdStrike API ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  return { ok: true, data: await res.json() }
}

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
  })
  if (!res.ok) throw new Error(`CrowdStrike auth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

export const crowdstrikeManifest: ConnectorManifest = {
  slug: 'crowdstrike',
  name: 'CrowdStrike Falcon',
  category: 'Security',
  description: 'EDR and threat intelligence — detections, host management, containment, vulnerabilities, IOCs, and Real-Time Response commands.',
  logoUrl: '/logos/crowdstrike.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Client ID',
    keyPlaceholder: 'CrowdStrike OAuth2 Client ID',
    keyHint: 'In Falcon console: Support & Resources → API clients → Create API client. Enable scopes for the operations you need.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'e.g. abc123def456...', inputType: 'text' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Secret from Falcon API clients page', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Create an API client in Falcon',
        description:
          'Log into the Falcon console, go to **Support & Resources → API clients and keys**, ' +
          'and click **Create API client**.',
      },
      {
        title: 'Set required scopes',
        description:
          'Add **Read** scope for: Detections, Hosts, Incidents, Vulnerabilities, IOC Management. ' +
          'Add **Write** scope for: Hosts (containment), IOC Management (create IOCs), Real Time Response.',
      },
    ],
  },

  testConnection: async (creds) => {
    try {
      const token = await getToken(creds.client_id, creds.client_secret)
      const res = await csGet(token, '/devices/queries/devices/v1?limit=1')
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, label: 'CrowdStrike Falcon connected' }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  actions: [
    {
      slug: 'list_detections',
      name: 'List Detections',
      description:
        'List recent CrowdStrike detections (threats found on endpoints). ' +
        'status: new, in_progress, true_positive, false_positive, ignored. limit defaults to 10.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max detections (default 10, max 100)' },
          status: { type: 'string', description: 'Filter by status: new, in_progress, true_positive, false_positive' },
          severity: { type: 'string', description: 'Filter by severity: Critical, High, Medium, Low, Informational' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 10, 100)
          let qs = `limit=${limit}`
          if (params.status) qs += `&filter=status:'${params.status}'`
          const ids = await csGet(token, `/detects/queries/detects/v1?${qs}`)
          if (!ids.ok || !(ids.data as { resources: string[] }).resources?.length) return { ok: true, data: [] }
          return csPost(token, '/detects/entities/summaries/GET/v1', {
            ids: (ids.data as { resources: string[] }).resources.slice(0, limit),
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_detection',
      name: 'Get Detection',
      description: 'Get full details of a specific CrowdStrike detection by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['detection_id'],
        properties: {
          detection_id: { type: 'string', description: 'CrowdStrike detection ID (e.g. ldt:xxx:yyy)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csPost(token, '/detects/entities/summaries/GET/v1', { ids: [params.detection_id] })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'update_detection',
      name: 'Update Detection',
      description:
        'Update the status or assignment of a CrowdStrike detection. ' +
        'status: new, in_progress, true_positive, false_positive, ignored. ' +
        'comment: Add a comment/note to the detection.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['detection_ids'],
        properties: {
          detection_ids: { type: 'string', description: 'Comma-separated detection IDs to update' },
          status: { type: 'string', enum: ['new', 'in_progress', 'true_positive', 'false_positive', 'ignored'], description: 'New detection status' },
          assigned_to_uuid: { type: 'string', description: 'User UUID to assign detections to (optional)' },
          comment: { type: 'string', description: 'Comment to add to detections (optional)' },
          show_in_ui: { type: 'boolean', description: 'Whether to show in UI (default: true)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const ids = (params.detection_ids as string).split(',').map(id => id.trim())
          const body: Record<string, unknown> = { ids }
          if (params.status) body.status = params.status
          if (params.assigned_to_uuid) body.assigned_to_uuid = params.assigned_to_uuid
          if (params.comment) body.comment = params.comment
          if (params.show_in_ui !== undefined) body.show_in_ui = params.show_in_ui
          return csPatch(token, '/detects/entities/detects/v2', body)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_hosts',
      name: 'List Hosts',
      description:
        'List endpoints (devices) managed by CrowdStrike Falcon. ' +
        'Returns hostname, platform, OS version, last seen, and containment status. limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max hosts (default 20, max 100)' },
          hostname_filter: { type: 'string', description: 'Filter by hostname prefix (optional)' },
          platform_name: { type: 'string', description: 'Filter by platform: Windows, Mac, Linux (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
          const filters: string[] = []
          if (params.hostname_filter) filters.push(`hostname:'${params.hostname_filter}*'`)
          if (params.platform_name) filters.push(`platform_name:'${params.platform_name}'`)
          const qs = [`limit=${limit}`, ...(filters.length ? [`filter=${encodeURIComponent(filters.join('+')).replace(/%2B/g, '+')}`] : [])]
          const ids = await csGet(token, `/devices/queries/devices/v1?${qs.join('&')}`)
          if (!ids.ok || !(ids.data as { resources: string[] }).resources?.length) return { ok: true, data: [] }
          const deviceIds = (ids.data as { resources: string[] }).resources.slice(0, limit)
          return csGet(token, `/devices/entities/devices/v2?${deviceIds.map(id => `ids=${id}`).join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_host_details',
      name: 'Get Host Details',
      description: 'Get full details of a CrowdStrike host by its device ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['device_id'],
        properties: {
          device_id: { type: 'string', description: 'CrowdStrike device ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csGet(token, `/devices/entities/devices/v2?ids=${params.device_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'contain_host',
      name: 'Contain Host',
      description:
        'Network-contain (isolate) a compromised endpoint — blocks all network traffic except CrowdStrike. ' +
        'Requires the host device_id from list_hosts.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['device_id'],
        properties: {
          device_id: { type: 'string', description: 'CrowdStrike device ID to contain' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csPost(token, '/devices/entities/devices-actions/v2?action_name=contain', {
            ids: [params.device_id],
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'lift_containment',
      name: 'Lift Containment',
      description: 'Remove network containment from a CrowdStrike-managed endpoint, restoring normal network access.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_id'],
        properties: {
          device_id: { type: 'string', description: 'CrowdStrike device ID to restore' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csPost(token, '/devices/entities/devices-actions/v2?action_name=lift_containment', {
            ids: [params.device_id],
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'hide_host',
      name: 'Hide Host',
      description: 'Hide a CrowdStrike host from the Falcon console. Use for decommissioned machines.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_id'],
        properties: {
          device_id: { type: 'string', description: 'CrowdStrike device ID to hide' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csPost(token, '/devices/entities/devices-actions/v2?action_name=hide_host', {
            ids: [params.device_id],
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_incidents',
      name: 'List Incidents',
      description:
        'List CrowdStrike incidents (grouped sets of detections). ' +
        'status: 20=New, 25=Reopened, 30=In Progress, 40=Closed. ' +
        'Returns incident ID, score, hosts involved, and tactic.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max incidents (default 10, max 100)' },
          status: { type: 'string', description: 'Filter by status code: 20=New, 25=Reopened, 30=In Progress, 40=Closed' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 10, 100)
          const qs: string[] = [`limit=${limit}`]
          if (params.status) qs.push(`filter=status:${params.status}`)
          const ids = await csGet(token, `/incidents/queries/incidents/v1?${qs.join('&')}`)
          if (!ids.ok || !(ids.data as { resources: string[] }).resources?.length) return { ok: true, data: [] }
          return csPost(token, '/incidents/entities/incidents/GET/v1', {
            ids: (ids.data as { resources: string[] }).resources.slice(0, limit),
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_iocs',
      name: 'List IOCs',
      description:
        'List custom IOCs (Indicators of Compromise) in CrowdStrike. ' +
        'type: sha256, md5, domain, ipv4, ipv6. action: detect, prevent, no_action.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'IOC type: sha256, md5, domain, ipv4, ipv6 (optional)' },
          action: { type: 'string', description: 'IOC action: detect, prevent, no_action (optional)' },
          limit: { type: 'number', description: 'Max IOCs (default 20, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
          const filters: string[] = []
          if (params.type) filters.push(`type:'${params.type}'`)
          if (params.action) filters.push(`action:'${params.action}'`)
          const qs = [`limit=${limit}`, ...(filters.length ? [`filter=${encodeURIComponent(filters.join('+')).replace(/%2B/g, '+')}`] : [])]
          const ids = await csGet(token, `/iocs/queries/indicators/v1?${qs.join('&')}`)
          if (!ids.ok || !(ids.data as { resources: string[] }).resources?.length) return { ok: true, data: [] }
          return csGet(token, `/iocs/entities/indicators/v1?${(ids.data as { resources: string[] }).resources.map(id => `ids=${id}`).join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'create_ioc',
      name: 'Create IOC',
      description:
        'Create a custom Indicator of Compromise (IOC) in CrowdStrike. ' +
        'type: sha256, md5, domain, ipv4, ipv6. ' +
        'action: detect (alert only), prevent (block), no_action. ' +
        'severity: critical, high, medium, low, informational.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['type', 'value', 'action', 'severity'],
        properties: {
          type: { type: 'string', enum: ['sha256', 'md5', 'domain', 'ipv4', 'ipv6'], description: 'IOC type' },
          value: { type: 'string', description: 'The actual indicator value (hash, domain, IP address)' },
          action: { type: 'string', enum: ['detect', 'prevent', 'no_action'], description: 'What to do when this IOC is seen' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'informational'], description: 'Alert severity' },
          description: { type: 'string', description: 'Description of this IOC (optional)' },
          source: { type: 'string', description: 'Source/origin of this IOC (optional)' },
          expiration: { type: 'string', description: 'Expiration datetime ISO 8601 (optional)' },
          platforms: { type: 'string', description: 'Comma-separated platforms: windows, mac, linux (default: all)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const platforms = params.platforms
            ? (params.platforms as string).split(',').map(p => p.trim())
            : ['windows', 'mac', 'linux']
          const indicator: Record<string, unknown> = {
            type: params.type,
            value: params.value,
            action: params.action,
            severity: params.severity,
            platforms,
          }
          if (params.description) indicator.description = params.description
          if (params.source) indicator.source = params.source
          if (params.expiration) indicator.expiration = params.expiration
          return csPost(token, '/iocs/entities/indicators/v1', { comment: 'Created via OrbitAPI', indicators: [indicator] })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'delete_ioc',
      name: 'Delete IOC',
      description: 'Delete a custom IOC from CrowdStrike by its indicator ID.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['indicator_id'],
        properties: {
          indicator_id: { type: 'string', description: 'IOC indicator ID to delete (from list_iocs)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          return csDelete(token, `/iocs/entities/indicators/v1?ids=${encodeURIComponent(params.indicator_id as string)}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_vulnerabilities',
      name: 'List Vulnerabilities',
      description:
        'List vulnerabilities found across CrowdStrike-protected hosts via Spotlight. ' +
        'severity: CRITICAL, HIGH, MEDIUM, LOW. status: open, closed, reopen. limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Filter by severity: CRITICAL, HIGH, MEDIUM, LOW' },
          status: { type: 'string', description: 'Filter by status: open, closed, reopen' },
          limit: { type: 'number', description: 'Max vulnerabilities (default 20, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
          const filters: string[] = []
          if (params.severity) filters.push(`cve.severity:'${params.severity}'`)
          if (params.status) filters.push(`status:'${params.status}'`)
          const qs = [`limit=${limit}`, ...(filters.length ? [`filter=${encodeURIComponent(filters.join('+')).replace(/%2B/g, '+')}`] : [])]
          return csGet(token, `/spotlight/combined/vulnerabilities/v1?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'run_rtr_command',
      name: 'Run Real-Time Response Command',
      description:
        'Execute a Real-Time Response (RTR) command on a host. ' +
        'command: ls, pwd, ps, netstat, cat, get (file download request). ' +
        'Note: RTR requires a session to be established first — results may be async.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['device_id', 'command'],
        properties: {
          device_id: { type: 'string', description: 'Target device ID' },
          command: { type: 'string', description: 'RTR command to run (e.g. ls, ps, netstat, cat /etc/hosts)' },
          base_command: { type: 'string', description: 'Base command type: ls, ps, netstat, cat, get, run (default: ls)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const sessionRes = await csPost(token, '/real-time-response/entities/sessions/v1', {
            device_id: params.device_id,
            origin: 'OrbitAPI',
            queue_offline: false,
          })
          if (!sessionRes.ok) return sessionRes
          const sessionId = (sessionRes.data as { resources: { session_id: string }[] }).resources?.[0]?.session_id
          if (!sessionId) return { ok: false, error: 'Failed to create RTR session' }
          const baseCommand = (params.base_command as string | undefined) ?? 'ls'
          const cmdRes = await csPost(token, '/real-time-response/entities/command/v1', {
            session_id: sessionId,
            base_command: baseCommand,
            command_string: params.command,
          })
          await csPost(token, '/real-time-response/entities/sessions/v1', { session_id: sessionId }).catch(() => null)
          return cmdRes
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'search_hosts',
      name: 'Search Hosts',
      description:
        'Search for CrowdStrike-protected hosts by hostname, local IP, external IP, or MAC address. ' +
        'Returns matching device IDs that can be used with get_host_details.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search term (hostname, IP, MAC address, or OS version)' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getToken(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
          const q = params.query as string
          const filter = encodeURIComponent(`hostname:'*${q}*'+local_ip:'${q}'+external_ip:'${q}'`)
          return csGet(token, `/devices/queries/devices/v1?limit=${limit}&filter=${filter}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
  ],
}

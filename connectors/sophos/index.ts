import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const AUTH_URL = 'https://id.sophos.com/api/v2/oauth2/token'
const WHOAMI_URL = 'https://api.central.sophos.com/whoami/v1'

interface SophosContext {
  token: string
  apiHost: string
  tenantId: string
}

async function getSophosContext(clientId: string, clientSecret: string): Promise<SophosContext> {
  const tokenRes = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=token`,
  })
  if (!tokenRes.ok) throw new Error(`Sophos auth failed: ${tokenRes.status}`)
  const tokenData = await tokenRes.json()
  const token = tokenData.access_token as string

  const whoamiRes = await fetch(WHOAMI_URL, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!whoamiRes.ok) throw new Error(`Sophos whoami failed: ${whoamiRes.status}`)
  const whoami = await whoamiRes.json()
  const apiHost = whoami.apiHosts?.dataRegion as string
  const tenantId = whoami.id as string
  if (!apiHost) throw new Error('Could not determine Sophos data region')
  return { token, apiHost, tenantId }
}

async function sophosGet(ctx: SophosContext, path: string): Promise<ActionResult> {
  const res = await fetch(`${ctx.apiHost}${path}`, {
    headers: {
      'Authorization': `Bearer ${ctx.token}`,
      'X-Tenant-ID': ctx.tenantId,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Sophos ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function sophosPost(ctx: SophosContext, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${ctx.apiHost}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ctx.token}`,
      'X-Tenant-ID': ctx.tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Sophos ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function sophosPatch(ctx: SophosContext, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${ctx.apiHost}${path}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${ctx.token}`,
      'X-Tenant-ID': ctx.tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Sophos ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function sophosDelete(ctx: SophosContext, path: string): Promise<ActionResult> {
  const res = await fetch(`${ctx.apiHost}${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ctx.token}`,
      'X-Tenant-ID': ctx.tenantId,
    },
  })
  if (res.status === 204) return { ok: true, data: { status: 'deleted' } }
  const text = await res.text().catch(() => res.statusText)
  return { ok: false, error: `Sophos ${res.status}: ${text}` }
}

export const sophosManifest: ConnectorManifest = {
  slug: 'sophos',
  name: 'Sophos Central',
  category: 'Security',
  description: 'EDR & endpoint protection — alerts, endpoint health, threat quarantine, isolation, scans, allowed items, and tamper protection.',
  logoUrl: '/logos/sophos.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Client ID',
    keyPlaceholder: 'Sophos API client ID',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Sophos Central API client ID', inputType: 'text' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Sophos Central API client secret', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Create an API credential in Sophos Central',
        description:
          'In Sophos Central Admin: **Global Settings → API Credentials → Add credential**. ' +
          'Set the role to **Service Principal ReadWrite** for full access.',
      },
      {
        title: 'Note on data regions',
        description:
          'Sophos automatically detects your data region from your credentials. No manual configuration needed.',
      },
    ],
  },

  testConnection: async (creds) => {
    try {
      const ctx = await getSophosContext(creds.client_id, creds.client_secret)
      const res = await sophosGet(ctx, '/endpoint/v1/endpoints?pageSize=1')
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, label: `Sophos Central (tenant: ${ctx.tenantId.slice(0, 8)}…)` }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  network: { hosts: ['api.central.sophos.com', 'id.sophos.com'] },

  actions: [
    {
      slug: 'list_alerts',
      name: 'List Alerts',
      description: 'List Sophos Central security alerts. severity: low, medium, high, critical. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Filter: low, medium, high, critical' },
          category: { type: 'string', description: 'Filter by category (optional)' },
          limit: { type: 'number', description: 'Max alerts (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`pageSize=${limit}`]
          if (params.severity) qs.push(`severity=${params.severity}`)
          if (params.category) qs.push(`category=${params.category}`)
          return sophosGet(ctx, `/siem/v1/alerts?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_endpoints',
      name: 'List Endpoints',
      description:
        'List endpoints managed by Sophos Central. ' +
        'Filter by healthStatus: good, suspicious, bad, unknown. Returns OS, IP, last seen, and health.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          health_status: { type: 'string', description: 'Filter: good, suspicious, bad, unknown' },
          type: { type: 'string', description: 'Filter: computer, server, securityVm' },
          search: { type: 'string', description: 'Search by hostname (optional)' },
          limit: { type: 'number', description: 'Max endpoints (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`pageSize=${limit}`, 'fields=id,hostname,type,health,os,ipAddresses,lastSeenAt,isolation']
          if (params.health_status) qs.push(`healthStatus=${params.health_status}`)
          if (params.type) qs.push(`type=${params.type}`)
          if (params.search) qs.push(`search=${encodeURIComponent(params.search as string)}`)
          return sophosGet(ctx, `/endpoint/v1/endpoints?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_endpoint',
      name: 'Get Endpoint',
      description: 'Get detailed information about a specific Sophos endpoint by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosGet(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'isolate_endpoint',
      name: 'Isolate Endpoint',
      description:
        'Network-isolate a Sophos-managed endpoint — blocks all traffic except Sophos management. ' +
        'Use when a device is compromised.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID to isolate' },
          comment: { type: 'string', description: 'Reason for isolation (shown in audit log)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosPatch(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/isolation`, {
            enabled: true,
            comment: params.comment ?? 'Isolated by OrbitAPI automation',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'remove_isolation',
      name: 'Remove Isolation',
      description: 'Remove network isolation from a Sophos endpoint, restoring normal connectivity.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID to de-isolate' },
          comment: { type: 'string', description: 'Reason for removing isolation' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosPatch(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/isolation`, {
            enabled: false,
            comment: params.comment ?? 'Isolation removed by OrbitAPI automation',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'scan_endpoint',
      name: 'Trigger Endpoint Scan',
      description: 'Trigger an on-demand antivirus scan on a Sophos-managed endpoint.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID to scan' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosPost(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/scans`, {})
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_endpoint_threats',
      name: 'Get Endpoint Threats',
      description: 'List detected threats on a specific Sophos endpoint.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID' },
          limit: { type: 'number', description: 'Max threats (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          return sophosGet(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/threats?pageSize=${limit}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_quarantine_items',
      name: 'List Quarantine Items',
      description: 'List files in the Sophos quarantine vault across all endpoints.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint_id: { type: 'string', description: 'Filter by endpoint ID (optional)' },
          limit: { type: 'number', description: 'Max items (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs: string[] = [`pageSize=${limit}`]
          if (params.endpoint_id) qs.push(`endpointId=${params.endpoint_id}`)
          return sophosGet(ctx, `/endpoint/v1/quarantine?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'authorize_quarantine_item',
      name: 'Authorize Quarantine Item',
      description: 'Mark a quarantined file as authorized (safe), releasing it from quarantine.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['item_id'],
        properties: {
          item_id: { type: 'string', description: 'Quarantine item ID to authorize' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosPost(ctx, `/endpoint/v1/quarantine/${params.item_id as string}/authorize`, {})
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'delete_quarantine_item',
      name: 'Delete Quarantine Item',
      description: 'Permanently delete a file from the Sophos quarantine vault.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['item_id'],
        properties: {
          item_id: { type: 'string', description: 'Quarantine item ID to permanently delete' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosDelete(ctx, `/endpoint/v1/quarantine/${params.item_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_tamper_protection',
      name: 'Get Tamper Protection Status',
      description: 'Get tamper protection status for a Sophos endpoint. Tamper protection prevents unauthorized uninstallation.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosGet(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/tamper-protection`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'toggle_tamper_protection',
      name: 'Toggle Tamper Protection',
      description:
        'Enable or disable tamper protection on a Sophos endpoint. ' +
        'Disabling is required for manual agent removal. enabled=false returns the uninstall password.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['endpoint_id', 'enabled'],
        properties: {
          endpoint_id: { type: 'string', description: 'Sophos endpoint UUID' },
          enabled: { type: 'boolean', description: 'true to enable tamper protection, false to disable' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          return sophosPatch(ctx, `/endpoint/v1/endpoints/${params.endpoint_id as string}/tamper-protection`, {
            enabled: params.enabled,
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_allowed_items',
      name: 'List Allowed Items',
      description: 'List items (file paths, certificates, SHA-256 hashes) on the Sophos allow list.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max items (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          return sophosGet(ctx, `/endpoint/v1/settings/allowed-items?pageSize=${limit}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'add_allowed_item',
      name: 'Add Allowed Item',
      description:
        'Add a file path, certificate, or SHA-256 hash to the Sophos allow list. ' +
        'type: path, sha256, certificate. Prevents Sophos from flagging this item.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['type', 'value'],
        properties: {
          type: { type: 'string', enum: ['path', 'sha256', 'certificate'], description: 'Item type' },
          value: { type: 'string', description: 'File path, hash, or certificate thumbprint' },
          comment: { type: 'string', description: 'Reason for allowing this item (optional)' },
          file_name: { type: 'string', description: 'File name (required for sha256 type)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const properties: Record<string, unknown> = {}
          if (params.type === 'path') properties.path = params.value
          if (params.type === 'sha256') {
            properties.sha256 = params.value
            if (params.file_name) properties.fileName = params.file_name
          }
          if (params.type === 'certificate') properties.thumbprint = params.value
          return sophosPost(ctx, '/endpoint/v1/settings/allowed-items', {
            type: params.type,
            properties,
            comment: params.comment ?? 'Added by OrbitAPI automation',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_events',
      name: 'List Security Events',
      description: 'List Sophos SIEM security events for threat hunting and investigation.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max events (default 25, max 1000)' },
          from_date: { type: 'string', description: 'ISO 8601 start date (optional)' },
          event_types: { type: 'string', description: 'Comma-separated event types to filter (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const ctx = await getSophosContext(creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 1000)
          const qs: string[] = [`pageSize=${limit}`]
          if (params.from_date) qs.push(`from_date=${params.from_date}`)
          if (params.event_types) qs.push(`event_types=${params.event_types}`)
          return sophosGet(ctx, `/siem/v1/events?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
  ],
}

import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function s1Fetch(managementUrl: string, apiToken: string, path: string, options: RequestInit = {}): Promise<ActionResult> {
  const base = managementUrl.replace(/\/$/, '')
  const url = `${base}/web/api/v2.1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `ApiToken ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `SentinelOne ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function s1Get(managementUrl: string, apiToken: string, path: string): Promise<ActionResult> {
  return s1Fetch(managementUrl, apiToken, path)
}

async function s1Post(managementUrl: string, apiToken: string, path: string, body: unknown): Promise<ActionResult> {
  return s1Fetch(managementUrl, apiToken, path, { method: 'POST', body: JSON.stringify(body) })
}

async function s1Put(managementUrl: string, apiToken: string, path: string, body: unknown): Promise<ActionResult> {
  return s1Fetch(managementUrl, apiToken, path, { method: 'PUT', body: JSON.stringify(body) })
}

async function s1Delete(managementUrl: string, apiToken: string, path: string, body?: unknown): Promise<ActionResult> {
  return s1Fetch(managementUrl, apiToken, path, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

export const sentineloneManifest: ConnectorManifest = {
  slug: 'sentinelone',
  name: 'SentinelOne',
  category: 'Security',
  description: 'AI-powered EDR — threats, agents, network isolation, mitigation, exclusions, activities, and automated response across your endpoint fleet.',
  logoUrl: '/logos/sentinelone.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Token',
    keyPlaceholder: 'SentinelOne API token',
    fields: [
      { key: 'management_url', label: 'Management URL', placeholder: 'https://usea1.sentinelone.net', inputType: 'text' },
      { key: 'api_token', label: 'API Token', placeholder: 'SentinelOne API token', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Find your Management URL',
        description:
          'Your SentinelOne console URL is your Management URL (e.g. https://usea1.sentinelone.net). ' +
          'Include the full https:// prefix.',
      },
      {
        title: 'Generate an API token',
        description:
          'In SentinelOne: **Settings → Users → your user → API Token → Generate**. ' +
          'Or create a dedicated service user with the **Viewer** or **SOC Analyst** role.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await s1Get(creds.management_url, creds.api_token, '/system/status')
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: `SentinelOne ${creds.management_url}` }
  },

  actions: [
    {
      slug: 'list_threats',
      name: 'List Threats',
      description:
        'List SentinelOne threats on endpoints. ' +
        'Filter by resolved: false=active (default), true=resolved. ' +
        'confidenceLevel: malicious, suspicious, n/a. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          resolved: { type: 'boolean', description: 'false=active threats (default), true=resolved' },
          confidenceLevel: { type: 'string', description: 'Filter: malicious, suspicious, n/a' },
          limit: { type: 'number', description: 'Max threats (default 25, max 100)' },
          agentId: { type: 'string', description: 'Filter by specific agent ID (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.resolved !== undefined) qs.push(`resolved=${params.resolved}`)
        if (params.confidenceLevel) qs.push(`confidenceLevels=${params.confidenceLevel}`)
        if (params.agentId) qs.push(`agentIds=${params.agentId}`)
        return s1Get(creds.management_url, creds.api_token, `/threats?${qs.join('&')}`)
      },
    },
    {
      slug: 'get_threat',
      name: 'Get Threat',
      description: 'Get full details of a specific SentinelOne threat by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['threat_id'],
        properties: {
          threat_id: { type: 'string', description: 'SentinelOne threat ID' },
        },
      },
      execute: async (creds, params) => {
        return s1Get(creds.management_url, creds.api_token, `/threats?ids=${params.threat_id as string}`)
      },
    },
    {
      slug: 'mitigate_threat',
      name: 'Mitigate Threat',
      description:
        'Apply a mitigation action to a threat. action: kill (terminate process), quarantine (move to vault), ' +
        'un-quarantine, remediate (revert all changes), or rollback-remediation (restore from VSS).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['threat_id', 'action'],
        properties: {
          threat_id: { type: 'string', description: 'SentinelOne threat ID' },
          action: { type: 'string', enum: ['kill', 'quarantine', 'un-quarantine', 'remediate', 'rollback-remediation'], description: 'Mitigation action' },
        },
      },
      execute: async (creds, params) => {
        return s1Post(creds.management_url, creds.api_token, `/threats/mitigate/${params.action as string}`, {
          filter: { ids: [params.threat_id] },
        })
      },
    },
    {
      slug: 'mark_as_benign',
      name: 'Mark Threat as Benign',
      description: 'Mark a SentinelOne threat as benign (false positive). Optionally whitelist to prevent future detection.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['threat_id'],
        properties: {
          threat_id: { type: 'string', description: 'SentinelOne threat ID to mark as benign' },
          target_scope: { type: 'string', description: 'Scope to whitelist: site (default), tenant, group (optional)' },
        },
      },
      execute: async (creds, params) => {
        return s1Post(creds.management_url, creds.api_token, '/threats/mark-as-benign', {
          filter: { ids: [params.threat_id] },
          data: { targetScope: (params.target_scope as string | undefined) ?? 'site' },
        })
      },
    },
    {
      slug: 'list_agents',
      name: 'List Agents',
      description:
        'List SentinelOne agents (endpoints). Filter by infected, networkStatus, or osType. ' +
        'networkStatus: connected, disconnected, not_applicable.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          infected: { type: 'boolean', description: 'true = only infected agents' },
          networkStatus: { type: 'string', description: 'Filter: connected, disconnected, not_applicable' },
          osType: { type: 'string', description: 'Filter: windows, macos, linux, windows_legacy' },
          isPendingUninstall: { type: 'boolean', description: 'Filter agents pending uninstall (optional)' },
          limit: { type: 'number', description: 'Max agents (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.infected !== undefined) qs.push(`infected=${params.infected}`)
        if (params.networkStatus) qs.push(`networkStatuses=${params.networkStatus}`)
        if (params.osType) qs.push(`osTypes=${params.osType}`)
        if (params.isPendingUninstall !== undefined) qs.push(`isPendingUninstall=${params.isPendingUninstall}`)
        return s1Get(creds.management_url, creds.api_token, `/agents?${qs.join('&')}`)
      },
    },
    {
      slug: 'get_agent',
      name: 'Get Agent',
      description: 'Get full details of a specific SentinelOne agent by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['agent_id'],
        properties: {
          agent_id: { type: 'string', description: 'SentinelOne agent ID' },
        },
      },
      execute: async (creds, params) => {
        return s1Get(creds.management_url, creds.api_token, `/agents?ids=${params.agent_id as string}`)
      },
    },
    {
      slug: 'isolate_agent',
      name: 'Isolate Agent',
      description:
        'Disconnect a SentinelOne agent from the network (isolate). ' +
        'All traffic is blocked except SentinelOne management. Provide comma-separated agent IDs.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs to isolate' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/disconnect', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'reconnect_agent',
      name: 'Reconnect Agent',
      description: 'Reconnect an isolated SentinelOne agent to the network, restoring normal connectivity.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs to reconnect' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/connect', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'initiate_scan',
      name: 'Initiate Full Disk Scan',
      description: 'Trigger a full disk scan on one or more SentinelOne agents.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs to scan' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/initiate-scan', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'abort_scan',
      name: 'Abort Disk Scan',
      description: 'Abort an in-progress disk scan on SentinelOne agents.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/abort-scan', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'decommission_agent',
      name: 'Decommission Agent',
      description:
        'Decommission (uninstall) a SentinelOne agent from an endpoint. ' +
        'This removes the agent and the endpoint from SentinelOne management. Use with caution.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs to decommission' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/decommission', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'list_groups',
      name: 'List Groups',
      description: 'List SentinelOne agent groups (used to organize endpoints and apply policies). Returns group ID, name, type, and agent count.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          site_id: { type: 'string', description: 'Filter by site ID (optional)' },
          limit: { type: 'number', description: 'Max groups (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.site_id) qs.push(`siteIds=${params.site_id}`)
        return s1Get(creds.management_url, creds.api_token, `/groups?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_sites',
      name: 'List Sites',
      description: 'List SentinelOne sites (top-level organizational units). Returns site ID, name, account, and license usage.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max sites (default 25)' },
          state: { type: 'string', description: 'Filter by state: active, expired, deleted (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.state) qs.push(`state=${params.state}`)
        return s1Get(creds.management_url, creds.api_token, `/sites?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_activities',
      name: 'List Activity Log',
      description:
        'List SentinelOne activity log entries for auditing. ' +
        'Returns user actions, policy changes, threat responses, and system events.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max activities (default 25, max 100)' },
          activity_types: { type: 'string', description: 'Comma-separated activity type IDs to filter (optional)' },
          agent_id: { type: 'string', description: 'Filter by agent ID (optional)' },
          threat_id: { type: 'string', description: 'Filter by threat ID (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`, 'sortBy=createdAt', 'sortOrder=desc']
        if (params.activity_types) qs.push(`activityTypes=${params.activity_types}`)
        if (params.agent_id) qs.push(`agentIds=${params.agent_id}`)
        if (params.threat_id) qs.push(`threatIds=${params.threat_id}`)
        return s1Get(creds.management_url, creds.api_token, `/activities?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_exclusions',
      name: 'List Exclusions',
      description: 'List SentinelOne detection exclusions (paths, hashes, or certificates excluded from scanning).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by type: path, certificate, browser, file_type, white_hash (optional)' },
          limit: { type: 'number', description: 'Max exclusions (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.type) qs.push(`type=${params.type}`)
        return s1Get(creds.management_url, creds.api_token, `/exclusions?${qs.join('&')}`)
      },
    },
    {
      slug: 'add_exclusion',
      name: 'Add Exclusion',
      description:
        'Add a new detection exclusion. type: path, certificate, browser, white_hash. ' +
        'os_type: windows, macos, linux, windows_legacy.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['value', 'type', 'os_type'],
        properties: {
          value: { type: 'string', description: 'The value to exclude (path, hash, etc.)' },
          type: { type: 'string', enum: ['path', 'certificate', 'browser', 'file_type', 'white_hash'], description: 'Exclusion type' },
          os_type: { type: 'string', enum: ['windows', 'macos', 'linux', 'windows_legacy'], description: 'OS type' },
          description: { type: 'string', description: 'Description/reason for the exclusion (optional)' },
          mode: { type: 'string', description: 'Exclusion mode: suppress, disable_in_process_monitor, disable_all_monitors, etc. (optional)' },
        },
      },
      execute: async (creds, params) => {
        return s1Post(creds.management_url, creds.api_token, '/exclusions', {
          data: {
            value: params.value,
            type: params.type,
            osType: params.os_type,
            description: params.description ?? '',
            mode: params.mode ?? 'suppress',
          },
        })
      },
    },
    {
      slug: 'fetch_agent_logs',
      name: 'Fetch Agent Logs',
      description: 'Request log collection from a SentinelOne agent. Logs will be available for download in the console.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['agent_ids'],
        properties: {
          agent_ids: { type: 'string', description: 'Comma-separated SentinelOne agent IDs to fetch logs from' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.agent_ids as string).split(',').map(s => s.trim()).filter(Boolean)
        return s1Post(creds.management_url, creds.api_token, '/agents/actions/fetch-logs', {
          filter: { ids },
          data: {},
        })
      },
    },
    {
      slug: 'get_system_status',
      name: 'Get System Status',
      description: 'Get the operational status of the SentinelOne management platform.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => {
        return s1Get(creds.management_url, creds.api_token, '/system/status')
      },
    },
    {
      slug: 'list_policies',
      name: 'List Policies',
      description: 'List SentinelOne protection policies. Returns policy ID, name, and scope (site or group).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          site_id: { type: 'string', description: 'Filter by site ID (optional)' },
          limit: { type: 'number', description: 'Max policies (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`limit=${limit}`]
        if (params.site_id) qs.push(`siteIds=${params.site_id}`)
        return s1Get(creds.management_url, creds.api_token, `/policies?${qs.join('&')}`)
      },
    },
  ],
}

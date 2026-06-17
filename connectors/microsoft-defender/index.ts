import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const BASE = 'https://api.securitycenter.microsoft.com/api'
const TOKEN_BASE = 'https://login.microsoftonline.com'

async function getDefenderToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${TOKEN_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.securitycenter.microsoft.com/.default',
    }).toString(),
  })
  if (!res.ok) throw new Error(`Defender auth failed: ${res.status} ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.access_token as string
}

async function defenderGet(token: string, path: string): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Defender ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function defenderPost(token: string, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
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
    return { ok: false, error: `Defender ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function defenderPatch(token: string, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${BASE}${path}`, {
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
    return { ok: false, error: `Defender ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

export const microsoftDefenderManifest: ConnectorManifest = {
  slug: 'microsoft-defender',
  name: 'Microsoft Defender for Endpoint',
  category: 'Security',
  description: 'EDR — alerts, machines, vulnerabilities, software inventory, threat investigations, indicators, and live response actions.',
  logoUrl: '/logos/microsoft-defender.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Client ID',
    keyPlaceholder: 'Azure AD App Client ID',
    fields: [
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure AD tenant / directory ID', inputType: 'text' },
      { key: 'client_id', label: 'Client ID', placeholder: 'Azure AD app (client) ID', inputType: 'text' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Azure AD app client secret', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Register an Azure AD application',
        description:
          'In Azure Portal: **Azure Active Directory → App registrations → New registration**. ' +
          'Name it (e.g. OrbitAPI-Defender), leave redirect URI blank, click Register.',
      },
      {
        title: 'Add API permissions',
        description:
          'In your app: **API permissions → Add a permission → APIs my organization uses → WindowsDefenderATP**. ' +
          'Add Application permissions: Alert.Read.All, Alert.ReadWrite.All, Machine.Read.All, Machine.Isolate, ' +
          'Machine.StopAndQuarantine, Vulnerability.Read.All, Ti.ReadWrite.All. ' +
          'Click **Grant admin consent**.',
      },
      {
        title: 'Create a client secret',
        description:
          'In your app: **Certificates & secrets → New client secret**. ' +
          'Copy the secret value immediately. Copy Tenant ID from the Overview page.',
      },
    ],
  },

  testConnection: async (creds) => {
    try {
      const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
      const res = await defenderGet(token, '/alerts?$top=1')
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, label: 'Microsoft Defender for Endpoint connected' }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  actions: [
    {
      slug: 'list_alerts',
      name: 'List Alerts',
      description:
        'List Microsoft Defender for Endpoint alerts. ' +
        'severity: Informational, Low, Medium, High. status: New, InProgress, Resolved. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Filter by severity: Informational, Low, Medium, High' },
          status: { type: 'string', description: 'Filter by status: New, InProgress, Resolved' },
          limit: { type: 'number', description: 'Max alerts (default 25, max 100)' },
          category: { type: 'string', description: 'Filter by category: General, Ransomware, CommandAndControl, etc. (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const filters: string[] = []
          if (params.severity) filters.push(`severity eq '${params.severity}'`)
          if (params.status) filters.push(`status eq '${params.status}'`)
          if (params.category) filters.push(`category eq '${params.category}'`)
          const qs = [`$top=${limit}`, '$orderby=alertCreationTime desc']
          if (filters.length) qs.push(`$filter=${encodeURIComponent(filters.join(' and '))}`)
          return defenderGet(token, `/alerts?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_alert',
      name: 'Get Alert',
      description: 'Get full details of a single Microsoft Defender alert by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['alert_id'],
        properties: {
          alert_id: { type: 'string', description: 'Defender alert ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderGet(token, `/alerts/${params.alert_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'update_alert',
      name: 'Update Alert',
      description:
        'Update a Defender alert status, classification, or determination. ' +
        'status: New, InProgress, Resolved. ' +
        'classification: Unknown, FalsePositive, TruePositive. ' +
        'determination: NotAvailable, Apt, Malware, SecurityPersonnel, SecurityTesting, UnwantedSoftware, Other.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['alert_id'],
        properties: {
          alert_id: { type: 'string', description: 'Defender alert ID' },
          status: { type: 'string', enum: ['New', 'InProgress', 'Resolved'], description: 'New status' },
          classification: { type: 'string', enum: ['Unknown', 'FalsePositive', 'TruePositive'], description: 'Alert classification' },
          determination: { type: 'string', description: 'Alert determination (e.g. NotAvailable, Malware, Apt, Other)' },
          comment: { type: 'string', description: 'Comment to add to the alert' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const { alert_id, ...updates } = params
          return defenderPatch(token, `/alerts/${alert_id as string}`, updates)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_machines',
      name: 'List Machines',
      description:
        'List machines onboarded to Microsoft Defender for Endpoint. ' +
        'Filter by riskScore: None, Informational, Low, Medium, High. Returns OS, IP, last seen, and health.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          riskScore: { type: 'string', description: 'Filter by risk: None, Informational, Low, Medium, High' },
          healthStatus: { type: 'string', description: 'Filter by health: Active, Inactive, ImpairedCommunication, NoSensorData' },
          limit: { type: 'number', description: 'Max machines (default 25, max 100)' },
          search: { type: 'string', description: 'Search by computer name or IP (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const filters: string[] = []
          if (params.riskScore) filters.push(`riskScore eq '${params.riskScore}'`)
          if (params.healthStatus) filters.push(`healthStatus eq '${params.healthStatus}'`)
          if (params.search) filters.push(`contains(computerDnsName,'${params.search}') or contains(lastIpAddress,'${params.search}')`)
          const qs = [`$top=${limit}`]
          if (filters.length) qs.push(`$filter=${encodeURIComponent(filters.join(' and '))}`)
          return defenderGet(token, `/machines?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_machine',
      name: 'Get Machine',
      description: 'Get full details of a Microsoft Defender machine by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['machine_id'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderGet(token, `/machines/${params.machine_id as string}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'isolate_machine',
      name: 'Isolate Machine',
      description:
        'Network-isolate a machine managed by Microsoft Defender for Endpoint. ' +
        'isolationType: Full (blocks all traffic) or Selective (allows Outlook and Teams).',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['machine_id', 'comment'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
          comment: { type: 'string', description: 'Reason for isolation (required by Defender API)' },
          isolationType: { type: 'string', enum: ['Full', 'Selective'], description: 'Full or Selective isolation (default: Full)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderPost(token, `/machines/${params.machine_id as string}/isolate`, {
            Comment: params.comment,
            IsolationType: params.isolationType ?? 'Full',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'release_machine',
      name: 'Release Machine from Isolation',
      description: 'Remove network isolation from a Microsoft Defender for Endpoint machine.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['machine_id', 'comment'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID to release' },
          comment: { type: 'string', description: 'Reason for releasing isolation' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderPost(token, `/machines/${params.machine_id as string}/unisolate`, {
            Comment: params.comment,
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'run_antivirus_scan',
      name: 'Run Antivirus Scan',
      description:
        'Trigger an antivirus scan on a Defender-managed machine. ' +
        'scanType: Quick or Full (complete disk scan, slower).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['machine_id', 'comment'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID to scan' },
          comment: { type: 'string', description: 'Reason for triggering the scan' },
          scanType: { type: 'string', enum: ['Quick', 'Full'], description: 'Quick or Full scan (default: Quick)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderPost(token, `/machines/${params.machine_id as string}/runAntiVirusScan`, {
            Comment: params.comment,
            ScanType: params.scanType ?? 'Quick',
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'stop_and_quarantine_file',
      name: 'Stop and Quarantine File',
      description:
        'Stop execution of a malicious file on a machine and quarantine it. ' +
        'sha1 is the file hash. Requires Machine.StopAndQuarantine permission.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['machine_id', 'sha1', 'comment'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
          sha1: { type: 'string', description: 'SHA-1 hash of the file to stop and quarantine' },
          comment: { type: 'string', description: 'Reason for stopping the file' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderPost(token, `/machines/${params.machine_id as string}/StopAndQuarantineFile`, {
            Comment: params.comment,
            Sha1: params.sha1,
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'collect_investigation_package',
      name: 'Collect Investigation Package',
      description: 'Collect a forensic investigation package from a machine for offline analysis.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['machine_id', 'comment'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
          comment: { type: 'string', description: 'Reason for collecting the package' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          return defenderPost(token, `/machines/${params.machine_id as string}/collectInvestigationPackage`, {
            Comment: params.comment,
          })
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_machine_vulnerabilities',
      name: 'List Machine Vulnerabilities',
      description: 'List CVE vulnerabilities discovered on a specific Defender-protected machine.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['machine_id'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
          limit: { type: 'number', description: 'Max vulnerabilities (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          return defenderGet(token, `/machines/${params.machine_id as string}/vulnerabilities?$top=${limit}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_vulnerabilities',
      name: 'List All Vulnerabilities',
      description:
        'List CVE vulnerabilities across all Defender-protected machines. ' +
        'Returns CVE ID, severity, exposed machines count, and CVSS score.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Filter by severity: Critical, High, Medium, Low' },
          limit: { type: 'number', description: 'Max vulnerabilities (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs = [`$top=${limit}`, '$orderby=exposedMachines desc']
          if (params.severity) qs.push(`$filter=${encodeURIComponent(`severity eq '${params.severity}' and exposedMachines gt 0`)}`)
          return defenderGet(token, `/vulnerabilities?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_software',
      name: 'List Software Inventory',
      description: 'List software installed on Defender-managed machines with vulnerability exposure info.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max software entries (default 25, max 100)' },
          has_vulnerabilities: { type: 'boolean', description: 'Only show software with known vulnerabilities (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs = [`$top=${limit}`]
          if (params.has_vulnerabilities) qs.push(`$filter=${encodeURIComponent('vulnerabilitiesCount gt 0')}`)
          return defenderGet(token, `/software?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_investigations',
      name: 'List Investigations',
      description: 'List automated investigations run by Defender. Returns investigation state, machine, and created time.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'Filter by state: Running, PendingApproval, PendingResource, PartiallyInvestigated, TerminatedByUser, TerminatedBySystem, Queued, InnerFailure, PreexistingAlert, UnsupportedOs, UnsupportedAlertType, SuppressedAlert' },
          limit: { type: 'number', description: 'Max investigations (default 10)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
          const qs = [`$top=${limit}`, '$orderby=createdTime desc']
          if (params.state) qs.push(`$filter=${encodeURIComponent(`state eq '${params.state}'`)}`)
          return defenderGet(token, `/investigations?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'list_indicators',
      name: 'List Custom Indicators',
      description: 'List custom threat indicators (IOCs) created in Microsoft Defender for Endpoint.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          indicator_type: { type: 'string', description: 'Filter by type: FileSha1, FileSha256, Url, DomainName, IpAddress (optional)' },
          limit: { type: 'number', description: 'Max indicators (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          const qs = [`$top=${limit}`]
          if (params.indicator_type) qs.push(`$filter=${encodeURIComponent(`indicatorType eq '${params.indicator_type}'`)}`)
          return defenderGet(token, `/indicators?${qs.join('&')}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'create_indicator',
      name: 'Create Custom Indicator',
      description:
        'Create a custom threat indicator (IOC) in Microsoft Defender for Endpoint. ' +
        'indicatorType: FileSha1, FileSha256, Url, DomainName, IpAddress. ' +
        'action: Alert, AlertAndBlock, Allowed.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['indicator_type', 'indicator_value', 'action', 'title', 'severity'],
        properties: {
          indicator_type: { type: 'string', enum: ['FileSha1', 'FileSha256', 'Url', 'DomainName', 'IpAddress'], description: 'Indicator type' },
          indicator_value: { type: 'string', description: 'The indicator value (hash, URL, domain, or IP)' },
          action: { type: 'string', enum: ['Alert', 'AlertAndBlock', 'Allowed'], description: 'Action to take when matched' },
          title: { type: 'string', description: 'Short title for this indicator' },
          severity: { type: 'string', enum: ['Informational', 'Low', 'Medium', 'High'], description: 'Alert severity' },
          description: { type: 'string', description: 'Description of the indicator (optional)' },
          expiration_time: { type: 'string', description: 'ISO 8601 expiration datetime (optional)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const indicator: Record<string, unknown> = {
            indicatorType: params.indicator_type,
            indicatorValue: params.indicator_value,
            action: params.action,
            title: params.title,
            severity: params.severity,
          }
          if (params.description) indicator.description = params.description
          if (params.expiration_time) indicator.expirationTime = params.expiration_time
          return defenderPost(token, '/indicators', indicator)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
    {
      slug: 'get_machine_alerts',
      name: 'Get Machine Alerts',
      description: 'Get all alerts associated with a specific Defender-protected machine.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['machine_id'],
        properties: {
          machine_id: { type: 'string', description: 'Defender machine ID' },
          limit: { type: 'number', description: 'Max alerts (default 25)' },
        },
      },
      execute: async (creds, params) => {
        try {
          const token = await getDefenderToken(creds.tenant_id, creds.client_id, creds.client_secret)
          const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
          return defenderGet(token, `/machines/${params.machine_id as string}/alerts?$top=${limit}`)
        } catch (e) { return { ok: false, error: String(e) } }
      },
    },
  ],
}

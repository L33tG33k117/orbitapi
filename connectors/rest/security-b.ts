import { defineRestConnector, apiKeyAuth, basicAuth } from '../factory'

// Security connectors B — PAM/secrets, SOAR, cloud & vuln management, threat intel.

export const cyberarkManifest = defineRestConnector({
  slug: 'cyberark',
  name: 'CyberArk',
  category: 'Security',
  description: 'Privileged accounts, safes, and users via the CyberArk PVWA REST API.',
  baseUrl: c => c.host,
  headers: c => ({ Authorization: c.token }),
  auth: {
    ...apiKeyAuth({ service: 'CyberArk', where: 'PVWA → API logon (session token)' }),
    fields: [
      { key: 'host', label: 'PVWA URL', placeholder: 'https://pvwa.yourcompany.com', inputType: 'text' },
      { key: 'token', label: 'Session token', placeholder: 'From /PasswordVault/API/auth/Cyberark/Logon', hint: 'Advanced — most people should use Simulate mode.' },
    ],
  },
  testPath: '/PasswordVault/api/Verify',
  testLabel: 'CyberArk vault connected',
  actions: [
    { slug: 'list_accounts', name: 'List privileged accounts', risk: 'read', path: '/PasswordVault/api/Accounts', staticQuery: { limit: '25' },
      description: 'Managed accounts. search: filter text (optional).',
      params: { search: { description: 'Search text (optional)' } } },
    { slug: 'get_account', name: 'Get account', risk: 'read', path: '/PasswordVault/api/Accounts/{account_id}',
      description: 'One managed account (never returns the secret itself).',
      params: { account_id: { description: 'Account ID', required: true } } },
    { slug: 'list_safes', name: 'List safes', risk: 'read', path: '/PasswordVault/api/Safes', staticQuery: { limit: '25' },
      description: 'Safes with member counts.', params: {} },
    { slug: 'list_users', name: 'List vault users', risk: 'read', path: '/PasswordVault/api/Users',
      description: 'Vault users.', params: {} },
    { slug: 'verify_account', name: 'Trigger credential verify', risk: 'write', method: 'POST', path: '/PasswordVault/api/Accounts/{account_id}/Verify',
      description: 'Queues a credential verification for a managed account.',
      params: { account_id: { description: 'Account ID', required: true } } },
  ],
})

export const hashicorpVaultManifest = defineRestConnector({
  slug: 'hashicorp-vault',
  name: 'HashiCorp Vault',
  category: 'Security',
  description: 'Health, mounts, policies, and KV secrets via the Vault HTTP API.',
  baseUrl: c => c.host,
  headers: c => ({ 'X-Vault-Token': c.token }),
  auth: {
    ...apiKeyAuth({ service: 'HashiCorp Vault', where: 'vault token create (or your auth method)' }),
    fields: [
      { key: 'host', label: 'Vault address', placeholder: 'https://vault.yourcompany.com:8200', inputType: 'text' },
      { key: 'token', label: 'Vault token', placeholder: 'hvs.…' },
    ],
  },
  testPath: '/v1/sys/health',
  testLabel: 'Vault server connected',
  actions: [
    { slug: 'get_health', name: 'Health check', risk: 'read', path: '/v1/sys/health',
      description: 'Seal status, HA mode, and version.', params: {} },
    { slug: 'list_mounts', name: 'List secret engines', risk: 'read', path: '/v1/sys/mounts',
      description: 'Mounted secret engines.', params: {} },
    { slug: 'list_policies', name: 'List policies', risk: 'read', path: '/v1/sys/policies/acl',
      description: 'ACL policies.', params: {} },
    { slug: 'list_auth_methods', name: 'List auth methods', risk: 'read', path: '/v1/sys/auth',
      description: 'Enabled auth methods.', params: {} },
    { slug: 'read_kv_secret', name: 'Read KV secret', risk: 'read', path: '/v1/secret/data/{secret_name}',
      description: 'Reads a top-level secret from the default KV v2 mount ("secret/"). Handle the returned values carefully.',
      params: { secret_name: { description: 'Secret name under secret/, e.g. myapp', required: true } } },
    { slug: 'write_kv_secret', name: 'Write KV secret', risk: 'write', method: 'POST', path: '/v1/secret/data/{secret_name}',
      description: 'Writes key/value data to a secret (creates a new version).',
      wrapBody: b => ({ data: b.data ?? {} }),
      params: { secret_name: { description: 'Secret name under secret/', required: true }, data: { type: 'object', description: 'Key/value pairs to store', required: true } } },
  ],
})

export const paloAltoXsoarManifest = defineRestConnector({
  slug: 'palo-alto-xsoar',
  name: 'Palo Alto XSOAR',
  category: 'Security',
  description: 'Incidents and playbook runs via the Cortex XSOAR API.',
  baseUrl: c => c.host,
  headers: c => ({ Authorization: c.api_key }),
  auth: {
    ...apiKeyAuth({ service: 'Cortex XSOAR', where: 'Settings → Integrations → API Keys' }),
    fields: [
      { key: 'host', label: 'XSOAR URL', placeholder: 'https://xsoar.yourcompany.com', inputType: 'text' },
      { key: 'api_key', label: 'API key', placeholder: 'Your XSOAR API key' },
    ],
  },
  testPath: '/about',
  testLabel: 'XSOAR server connected',
  actions: [
    { slug: 'search_incidents', name: 'Search incidents', risk: 'read', method: 'POST', path: '/incidents/search',
      description: 'Recent incidents. query: Lucene filter, e.g. status:Active (optional).',
      wrapBody: b => ({ filter: { page: 0, size: 25, ...(b.query ? { query: b.query } : {}) } }),
      params: { query: { description: 'Filter query (optional)' } } },
    { slug: 'create_incident', name: 'Create incident', risk: 'write', method: 'POST', path: '/incident',
      description: 'Creates an incident. severity 0–4.',
      wrapBody: b => ({ name: b.name, severity: Number(b.severity ?? 1), ...(b.type ? { type: b.type } : {}), createInvestigation: true }),
      params: { name: { description: 'Incident name', required: true }, severity: { type: 'integer', description: '0 info – 4 critical (default 1)' }, type: { description: 'Incident type (optional)' } } },
    { slug: 'close_incident', name: 'Close incident', risk: 'write', method: 'POST', path: '/incident/close',
      description: 'Closes an incident with a reason.',
      wrapBody: b => ({ id: b.incident_id, closeReason: b.reason ?? 'Resolved' }),
      params: { incident_id: { description: 'Incident ID', required: true }, reason: { description: 'Close reason (optional)' } } },
  ],
})

export const wizManifest = defineRestConnector({
  slug: 'wiz',
  name: 'Wiz',
  category: 'Security',
  description: 'Cloud security issues and projects via the Wiz GraphQL API.',
  baseUrl: c => c.api_endpoint,
  headers: c => ({ Authorization: `Bearer ${c.access_token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Wiz', where: 'Settings → Service Accounts (OAuth token)' }),
    fields: [
      { key: 'api_endpoint', label: 'API endpoint', placeholder: 'https://api.us17.app.wiz.io', inputType: 'text' },
      { key: 'access_token', label: 'OAuth access token', placeholder: 'Your Wiz token', hint: 'Advanced — most people should use Simulate mode.' },
    ],
  },
  testPath: '/graphql',
  testInit: { method: 'POST', body: { query: '{ viewer { id } }' } },
  testLabel: 'Wiz tenant connected',
  actions: [
    { slug: 'list_issues', name: 'List issues', risk: 'read', method: 'POST', path: '/graphql',
      description: 'Open cloud security issues sorted by severity.',
      wrapBody: b => ({ query: `query { issues(first: 25, filterBy: { status: [OPEN] ${b.severity ? `, severity: [${String(b.severity).toUpperCase()}]` : ''} }) { nodes { id severity status createdAt entitySnapshot { name type } sourceRule { name } } } }` }),
      params: { severity: { description: 'Filter: critical | high | medium | low (optional)', enum: ['critical', 'high', 'medium', 'low'] } } },
    { slug: 'list_projects', name: 'List projects', risk: 'read', method: 'POST', path: '/graphql',
      description: 'Wiz projects with risk profile.',
      wrapBody: () => ({ query: '{ projects(first: 25) { nodes { id name slug riskProfile { businessImpact } } } }' }),
      params: {} },
  ],
})

export const orcaSecurityManifest = defineRestConnector({
  slug: 'orca-security',
  name: 'Orca Security',
  category: 'Security',
  description: 'Cloud security alerts and assets via the Orca API.',
  baseUrl: 'https://api.orcasecurity.io/api',
  headers: c => ({ Authorization: `Token ${c.api_key}` }),
  auth: apiKeyAuth({ service: 'Orca Security', keyLabel: 'API token', where: 'Settings → Users & Permissions → API' }),
  testPath: '/user/session',
  testLabel: 'Orca account connected',
  actions: [
    { slug: 'list_alerts', name: 'List alerts', risk: 'read', path: '/alerts', staticQuery: { limit: '25' },
      description: 'Cloud security alerts with score and category.', params: {} },
    { slug: 'get_alert', name: 'Get alert', risk: 'read', path: '/alerts/{alert_id}',
      description: 'One alert with remediation guidance.',
      params: { alert_id: { description: 'Alert ID', required: true } } },
    { slug: 'list_assets', name: 'List assets', risk: 'read', path: '/assets', staticQuery: { limit: '25' },
      description: 'Discovered cloud assets.', params: {} },
  ],
})

export const qualysManifest = defineRestConnector({
  slug: 'qualys',
  name: 'Qualys VMDR',
  category: 'Security',
  description: 'Asset and vulnerability queries via the Qualys Gateway API.',
  baseUrl: c => c.gateway_url,
  headers: c => ({ Authorization: `Bearer ${c.token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Qualys', where: 'Qualys Gateway (JWT from /auth)' }),
    fields: [
      { key: 'gateway_url', label: 'Gateway URL', placeholder: 'https://gateway.qg1.apps.qualys.com', inputType: 'text' },
      { key: 'token', label: 'JWT token', placeholder: 'Your Qualys JWT', hint: 'Advanced — most people should use Simulate mode.' },
    ],
  },
  testPath: '/rest/2.0/count/am/asset',
  testLabel: 'Qualys platform connected',
  actions: [
    { slug: 'search_assets', name: 'Search assets', risk: 'read', method: 'POST', path: '/rest/2.0/search/am/asset', staticQuery: { pageSize: '25' },
      description: 'Assets with OS and open vulnerability counts. filter: Qualys QQL (optional).',
      wrapBody: b => (b.filter ? { filter: b.filter } : {}),
      params: { filter: { description: 'QQL filter, e.g. operatingSystem:Windows (optional)' } } },
    { slug: 'count_assets', name: 'Count assets', risk: 'read', method: 'POST', path: '/rest/2.0/count/am/asset',
      description: 'Total asset count matching an optional QQL filter.',
      wrapBody: b => (b.filter ? { filter: b.filter } : {}),
      params: { filter: { description: 'QQL filter (optional)' } } },
  ],
})

export const tenableManifest = defineRestConnector({
  slug: 'tenable',
  name: 'Tenable.io',
  category: 'Security',
  description: 'Scans, assets, and vulnerabilities via the Tenable Vulnerability Management API.',
  baseUrl: 'https://cloud.tenable.com',
  headers: c => ({ 'X-ApiKeys': `accessKey=${c.access_key};secretKey=${c.secret_key}` }),
  auth: {
    ...apiKeyAuth({ service: 'Tenable', where: 'Settings → My Account → API Keys' }),
    fields: [
      { key: 'access_key', label: 'Access key', placeholder: 'Your access key', inputType: 'text' },
      { key: 'secret_key', label: 'Secret key', placeholder: 'Your secret key' },
    ],
  },
  testPath: '/session',
  testLabel: 'Tenable.io connected',
  actions: [
    { slug: 'list_scans', name: 'List scans', risk: 'read', path: '/scans',
      description: 'Configured scans with last run status.', params: {} },
    { slug: 'launch_scan', name: 'Launch scan', risk: 'write', method: 'POST', path: '/scans/{scan_id}/launch',
      description: 'Starts a scan now.',
      params: { scan_id: { type: 'integer', description: 'Scan ID', required: true } } },
    { slug: 'list_assets', name: 'List assets', risk: 'read', path: '/assets',
      description: 'Discovered assets.', params: {} },
    { slug: 'list_vulnerabilities', name: 'List vulnerabilities', risk: 'read', path: '/workbenches/vulnerabilities', staticQuery: { page: '0', size: '25' },
      description: 'Current vulnerabilities ranked by severity.', params: {} },
  ],
})

export const rapid7Manifest = defineRestConnector({
  slug: 'rapid7',
  name: 'Rapid7 InsightVM',
  category: 'Security',
  description: 'Assets and vulnerabilities via the Rapid7 Insight platform API.',
  baseUrl: c => `https://${c.region || 'us'}.api.insight.rapid7.com`,
  headers: c => ({ 'X-Api-Key': c.api_key }),
  auth: {
    ...apiKeyAuth({ service: 'Rapid7 Insight', where: 'Platform Home → API Keys' }),
    fields: [
      { key: 'api_key', label: 'API key', placeholder: 'Your Insight platform key' },
      { key: 'region', label: 'Region', placeholder: 'us | eu | ca | au | ap (default us)', inputType: 'text' },
    ],
  },
  testPath: '/validate',
  testLabel: 'Rapid7 Insight connected',
  actions: [
    { slug: 'search_assets', name: 'Search assets', risk: 'read', method: 'POST', path: '/vm/v4/integration/assets', staticQuery: { size: '25' },
      description: 'Assets with risk score and vulnerability counts.',
      wrapBody: b => ({ asset: b.query ?? '' }),
      params: { query: { description: 'Asset search query (optional)' } } },
    { slug: 'search_vulnerabilities', name: 'Search vulnerabilities', risk: 'read', method: 'POST', path: '/vm/v4/integration/vulnerabilities', staticQuery: { size: '25' },
      description: 'Vulnerability definitions matching a query.',
      wrapBody: b => ({ vulnerability: b.query ?? '' }),
      params: { query: { description: 'Vulnerability search, e.g. severity = CRITICAL (optional)' } } },
  ],
})

export const virustotalManifest = defineRestConnector({
  slug: 'virustotal',
  name: 'VirusTotal',
  category: 'Security',
  description: 'File, URL, domain, and IP reputation lookups via the VirusTotal API.',
  baseUrl: 'https://www.virustotal.com/api/v3',
  formEncoded: true,
  headers: c => ({ 'x-apikey': c.api_key }),
  auth: apiKeyAuth({ service: 'VirusTotal', keyLabel: 'API key', where: 'virustotal.com → your profile → API key' }),
  testPath: '/users/current',
  testLabel: 'VirusTotal connected',
  actions: [
    { slug: 'lookup_hash', name: 'Look up file hash', risk: 'read', path: '/files/{hash}',
      description: 'Reputation report for a file hash (MD5/SHA1/SHA256).',
      params: { hash: { description: 'File hash', required: true } } },
    { slug: 'lookup_domain', name: 'Look up domain', risk: 'read', path: '/domains/{domain}',
      description: 'Reputation report for a domain.',
      params: { domain: { description: 'Domain, e.g. example.com', required: true } } },
    { slug: 'lookup_ip', name: 'Look up IP', risk: 'read', path: '/ip_addresses/{ip}',
      description: 'Reputation report for an IP address.',
      params: { ip: { description: 'IPv4/IPv6 address', required: true } } },
    { slug: 'scan_url', name: 'Submit URL for scanning', risk: 'write', method: 'POST', path: '/urls',
      description: 'Submits a URL for analysis; returns an analysis ID.',
      params: { url: { description: 'URL to scan', required: true } } },
    { slug: 'get_analysis', name: 'Get analysis result', risk: 'read', path: '/analyses/{analysis_id}',
      description: 'Result of a submitted scan.',
      params: { analysis_id: { description: 'Analysis ID from scan_url', required: true } } },
  ],
})

export const proofpointManifest = defineRestConnector({
  slug: 'proofpoint',
  name: 'Proofpoint',
  category: 'Security',
  description: 'Email threat events and very-attacked-people via the Proofpoint TAP API.',
  baseUrl: 'https://tap-api-v2.proofpoint.com',
  headers: c => ({ Authorization: basicAuth(c.service_principal, c.secret) }),
  auth: {
    ...apiKeyAuth({ service: 'Proofpoint TAP', where: 'Settings → Connected Applications (service principal + secret)' }),
    fields: [
      { key: 'service_principal', label: 'Service principal', placeholder: 'UUID', inputType: 'text' },
      { key: 'secret', label: 'Secret', placeholder: 'Your TAP secret' },
    ],
  },
  testPath: '/v2/siem/all?format=json&sinceSeconds=60',
  testLabel: 'Proofpoint TAP connected',
  actions: [
    { slug: 'list_siem_events', name: 'List threat events', risk: 'read', path: '/v2/siem/all', staticQuery: { format: 'json' },
      description: 'Blocked/delivered email threats. sinceSeconds: look-back (default 3600, max 3600).',
      params: { sinceSeconds: { type: 'integer', description: 'Look-back seconds (default 3600)' } } },
    { slug: 'list_vap', name: 'Very Attacked People', risk: 'read', path: '/v2/people/vap', staticQuery: { window: '30' },
      description: 'Most-attacked users over the last 30 days.', params: {} },
    { slug: 'decode_urls', name: 'Decode rewritten URLs', risk: 'read', method: 'POST', path: '/v2/url/decode',
      description: 'Decodes Proofpoint-rewritten URLs back to the original.',
      wrapBody: b => ({ urls: [b.url] }),
      params: { url: { description: 'Rewritten urldefense URL', required: true } } },
    { slug: 'get_campaign', name: 'Get campaign', risk: 'read', path: '/v2/campaign/{campaign_id}',
      description: 'Details of a threat campaign.',
      params: { campaign_id: { description: 'Campaign ID from SIEM events', required: true } } },
  ],
})

export const knowbe4Manifest = defineRestConnector({
  slug: 'knowbe4',
  name: 'KnowBe4',
  category: 'Security',
  description: 'Phishing tests, training campaigns, and user risk scores via the KnowBe4 API.',
  baseUrl: c => `https://${c.region || 'us'}.api.knowbe4.com/v1`,
  headers: c => ({ Authorization: `Bearer ${c.api_key}` }),
  auth: {
    ...apiKeyAuth({ service: 'KnowBe4', where: 'Account Settings → API' }),
    fields: [
      { key: 'api_key', label: 'API token', placeholder: 'Your KnowBe4 token' },
      { key: 'region', label: 'Region', placeholder: 'us | eu (default us)', inputType: 'text' },
    ],
  },
  testPath: '/account',
  testLabel: 'KnowBe4 account connected',
  actions: [
    { slug: 'get_account', name: 'Account overview', risk: 'read', path: '/account',
      description: 'Account info including overall Risk Score.', params: {} },
    { slug: 'list_users', name: 'List users', risk: 'read', path: '/users', staticQuery: { per_page: '25' },
      description: 'Users with individual risk scores.', params: {} },
    { slug: 'list_phishing_campaigns', name: 'List phishing campaigns', risk: 'read', path: '/phishing/campaigns',
      description: 'Phishing simulation campaigns.', params: {} },
    { slug: 'list_phishing_tests', name: 'List phishing tests', risk: 'read', path: '/phishing/security_tests',
      description: 'Individual phishing tests with click/report rates.', params: {} },
    { slug: 'list_training_campaigns', name: 'List training campaigns', risk: 'read', path: '/training/campaigns',
      description: 'Security awareness training campaigns with completion.', params: {} },
  ],
})

export const securityBConnectors = [
  cyberarkManifest, hashicorpVaultManifest, paloAltoXsoarManifest, wizManifest,
  orcaSecurityManifest, qualysManifest, tenableManifest, rapid7Manifest,
  virustotalManifest, proofpointManifest, knowbe4Manifest,
]

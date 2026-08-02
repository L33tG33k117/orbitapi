import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AI_MAX_RETRIES } from '@/lib/ai-resilience'

export interface ConnectorBuildResult {
  validated: boolean
  validation_message?: string
  slug: string
  category: string
  description: string
  manifestCode: string
  catalogEntry: string
  importLine: string
  exportEntry: string
  logoSvg: string
  examples?: {
    chatPhrases: string[]
    automations: { name: string; description: string }[]
  }
  // Per-action sample success payloads for Simulate mode (action slug -> the
  // `data` a successful call returns). Written into lib/simulate-action.ts on apply.
  simulatedData?: Record<string, unknown>
}

const CATEGORIES = [
  'Security', 'Incident Management', 'Communication', 'Finance',
  'CRM & Support', 'Cloud & Infrastructure', 'DevOps', 'Productivity',
  'Short-Term Rental', 'Smart Home', 'Data & Analytics',
]

const EXAMPLE = `\
// connectors/zendesk/index.ts
import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function zdFetch(subdomain: string, email: string, token: string, path: string, options: RequestInit = {}): Promise<ActionResult> {
  const url = \`https://\${subdomain}.zendesk.com/api/v2\${path}\`
  const basicAuth = Buffer.from(\`\${email}/token:\${token}\`).toString('base64')
  const res = await fetch(url, {
    ...options,
    headers: { 'Authorization': \`Basic \${basicAuth}\`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
  if (!res.ok) return { ok: false, error: \`Zendesk \${res.status}: \${await res.text().catch(() => res.statusText)}\` }
  return { ok: true, data: await res.json() }
}

export const zendeskManifest: ConnectorManifest = {
  slug: 'zendesk',
  name: 'Zendesk Support',
  category: 'CRM & Support',
  description: 'Customer support — tickets, users, organizations, SLA policies, and CSAT scores.',
  logoUrl: '/logos/zendesk.svg',
  isSimulated: false,
  auth: {
    type: 'api_key',
    keyLabel: 'API Token',
    keyPlaceholder: 'Your Zendesk API token',
    fields: [
      { key: 'subdomain', label: 'Subdomain', placeholder: 'e.g. acme (from acme.zendesk.com)', inputType: 'text' },
      { key: 'email', label: 'Agent Email', placeholder: 'agent@yourcompany.com', inputType: 'text' },
      { key: 'token', label: 'API Token', placeholder: 'Zendesk API token', inputType: 'password' },
    ],
    setupGuide: [
      { title: 'Find your subdomain', description: 'Your Zendesk URL is **{subdomain}.zendesk.com** — copy the prefix.' },
      { title: 'Generate an API token', description: 'Admin Center → Apps and integrations → Zendesk API → Add API token.' },
    ],
  },
  testConnection: async (creds) => {
    const res = await zdFetch(creds.subdomain, creds.email, creds.token, '/tickets.json?page[size]=1')
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: \`Zendesk \${creds.subdomain}.zendesk.com\` }
  },
  actions: [
    {
      slug: 'list_tickets',
      name: 'List Tickets',
      description: 'List Zendesk support tickets. Filter by status: new, open, pending, hold, solved, closed. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by ticket status' },
          limit: { type: 'number', description: 'Max results (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return zdFetch(creds.subdomain, creds.email, creds.token, \`/tickets.json?page[size]=\${limit}\`)
      },
    },
  ],
}`

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Force a connector's slug to `preferred` across every slug-bearing field, so a
// build claims an existing catalog placeholder's slug rather than creating a
// parallel entry. Targeted replacements only (never a blind global replace —
// the slug can appear inside real API URLs/descriptions).
function forceSlug(r: ConnectorBuildResult, preferred: string): ConnectorBuildResult {
  const from = r.slug
  if (!from || from === preferred) { r.slug = preferred; return r }
  const slugField = new RegExp(`slug:\\s*'${escapeRegExp(from)}'`, 'g')
  const logoPath = new RegExp(`/logos/${escapeRegExp(from)}\\.svg`, 'g')
  const importPath = new RegExp(`from '\\./${escapeRegExp(from)}'`, 'g')
  r.manifestCode = r.manifestCode.replace(slugField, `slug: '${preferred}'`).replace(logoPath, `/logos/${preferred}.svg`)
  r.catalogEntry = r.catalogEntry.replace(slugField, `slug: '${preferred}'`).replace(logoPath, `/logos/${preferred}.svg`)
  r.importLine = r.importLine.replace(importPath, `from './${preferred}'`)
  r.slug = preferred
  return r
}

export async function buildConnector(
  connectorName: string,
  useCase: string | null,
  websiteUrl?: string | null,
  preferredSlug?: string | null,
): Promise<ConnectorBuildResult> {
  const { text } = await generateText({
    model: anthropic('claude-opus-4-8'),
    maxRetries: AI_MAX_RETRIES,
    maxOutputTokens: 8000,
    messages: [
      {
        role: 'user',
        content: `You are a TypeScript developer building an API connector for OrbitAPI, an AI-powered API automation platform.

CONNECTOR INTERFACE (simplified):
\`\`\`ts
interface ConnectorManifest {
  slug: string                // kebab-case
  name: string
  category: string
  description: string         // one-line catalog description
  logoUrl?: string            // '/logos/[slug].svg'
  isSimulated: boolean        // always false
  auth: ApiKeyAuth | OAuth2Auth
  testConnection: (creds) => Promise<{ ok: boolean; label?: string; error?: string }>
  actions: ActionDef[]
}
interface ApiKeyAuth {
  type: 'api_key'
  keyLabel: string; keyPlaceholder: string
  fields?: { key: string; label: string; placeholder: string; inputType?: 'text' | 'password' }[]
  setupGuide: { title: string; description: string }[]
}
interface ActionDef {
  slug: string; name: string; description: string
  risk: 'read' | 'write' | 'destructive'
  inputSchema: JSONSchema
  execute: (creds: Record<string, string>, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>
}
\`\`\`

EXAMPLE CONNECTOR:
${EXAMPLE}

CATEGORIES: ${CATEGORIES.join(', ')}

TASK: Build a complete, production-quality connector for: **${connectorName}**
${websiteUrl ? `API documentation / website: ${websiteUrl}` : ''}
${useCase ? `Use case context: ${useCase}` : ''}
${preferredSlug ? `REQUIRED SLUG: use exactly "${preferredSlug}" as the slug everywhere (manifest slug, logoUrl path '/logos/${preferredSlug}.svg', import path './${preferredSlug}', and catalog entry). Do not invent a different slug.` : ''}

CRITICAL GUARDRAILS — you MUST follow these:
1. Only build this connector if ${connectorName} has a REAL, publicly documented REST or GraphQL API
2. Do NOT guess API endpoints — use only documented, confirmed API paths
3. If you are not confident this is a real public API with documented endpoints, set "validated": false and explain in "validation_message"
4. Do NOT build connectors for APIs that require undisclosed proprietary contracts or have no public docs
5. All API base URLs must be real (e.g. https://api.example.com/v1, not made-up)
6. Auth must reflect the actual auth method this API uses (check docs)

Requirements:
- 5-8 meaningful, realistic actions covering the most useful API operations
- Each execute() must contain real API calls (correct URLs, headers, auth)
- The manifest export variable must be camelCase + "Manifest" (e.g. githubManifest)
- Import path alias is @/connectors/types
- isSimulated: false
- logoUrl: '/logos/[slug].svg'
- Pick the best matching category from the list above
- Include 5 example chat phrases and 3-4 automation ideas
- Include "simulatedData": for EVERY action slug, a realistic sample of the data field a successful call returns (used for Simulate mode so the connector demos with believable fake data, not a generic stub)

Respond with ONLY a valid JSON object — no markdown, no explanation, no \`\`\` fences:
{
  "validated": true,
  "validation_message": "Confirmed: [connector] has a public REST API documented at [url]",
  "slug": "kebab-case-slug",
  "category": "Category Name",
  "description": "One-line catalog description under 100 chars",
  "manifestCode": "// full TypeScript file content\\nimport type { ConnectorManifest ... }\\n...",
  "catalogEntry": "{ slug: 'slug', name: 'Name', category: 'Category', description: 'desc', logoUrl: '/logos/slug.svg', available: true, badgeNew: true }",
  "importLine": "import { nameManifest } from './slug'",
  "exportEntry": "nameManifest",
  "logoSvg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 64 64\\"><rect width=\\"64\\" height=\\"64\\" rx=\\"14\\" fill=\\"#BRAND_COLOR\\"/><!-- symbol --></svg>",
  "examples": {
    "chatPhrases": ["List all ...", "Get ... by ID", "Create a new ...", "Search for ...", "Update ..."],
    "automations": [
      { "name": "Automation Name", "description": "What this automation does automatically" }
    ]
  },
  "simulatedData": {
    "action_slug": { "items": [ /* realistic sample of the data a successful call returns */ ] }
  }
}`,
      },
    ],
  })

  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: ConnectorBuildResult
  try {
    parsed = JSON.parse(cleaned) as ConnectorBuildResult
  } catch {
    const match = cleaned.match(/\{[\s\S]+\}/)
    if (!match) throw new Error(`Could not parse AI output. First 300 chars: ${text.slice(0, 300)}`)
    parsed = JSON.parse(match[0]) as ConnectorBuildResult
  }

  // Claim the requested slug even if the model picked its own (belt-and-suspenders
  // for the prompt instruction above) — but only for validated builds.
  if (preferredSlug && parsed.validated !== false) return forceSlug(parsed, preferredSlug)
  return parsed
}

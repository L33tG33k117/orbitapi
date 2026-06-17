export interface SetupStep {
  title: string
  description: string
  imageUrl?: string
}

export type AuthType = 'api_key' | 'oauth2'

export interface CredentialField {
  key: string           // the key stored in credentials JSON
  label: string
  placeholder: string
  hint?: string
  inputType?: 'text' | 'password'   // default 'password'
}

export interface ApiKeyAuth {
  type: 'api_key'
  keyLabel: string          // e.g. "API Key" — used when fields is absent
  keyPlaceholder: string
  keyHint?: string
  fields?: CredentialField[] // when set, replaces the single api_key field
  setupGuide: SetupStep[]
}

export interface OAuth2Auth {
  type: 'oauth2'
  authUrl: string
  tokenUrl: string
  scopes: string[]
  setupGuide: SetupStep[]
}

export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  description?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  items?: JSONSchema
  [key: string]: unknown
}

export type ActionRisk = 'read' | 'write' | 'destructive'

export interface ActionResult {
  ok: boolean
  data?: unknown
  error?: string
}

export interface ActionDef {
  slug: string
  name: string                 // human-readable
  description: string          // written for the LLM — clear, example-rich
  risk: ActionRisk
  inputSchema: JSONSchema
  execute: (creds: Record<string, string>, params: Record<string, unknown>) => Promise<ActionResult>
}

export interface ConnectorManifest {
  slug: string
  name: string
  category: string
  description: string          // one-line, shown in catalog
  logoUrl?: string
  isSimulated: boolean
  auth: ApiKeyAuth | OAuth2Auth
  actions: ActionDef[]
  testConnection: (creds: Record<string, string>) => Promise<{ ok: boolean; label?: string; error?: string }>
}

// Serializable subset — safe to pass from Server Components to Client Components.
// Functions (execute, testConnection) are stripped.
export interface ActionSummary {
  slug: string
  name: string
  risk: ActionRisk
}

export interface ConnectorSummary {
  slug: string
  name: string
  category: string
  description: string
  logoUrl?: string
  isSimulated: boolean
  auth: ApiKeyAuth | OAuth2Auth   // contains only strings/arrays — serializable
  actions: ActionSummary[]
}

export function toSummary(m: ConnectorManifest): ConnectorSummary {
  return {
    slug: m.slug,
    name: m.name,
    category: m.category,
    description: m.description,
    logoUrl: m.logoUrl,
    isSimulated: m.isSimulated,
    auth: m.auth,
    actions: m.actions.map(a => ({ slug: a.slug, name: a.name, risk: a.risk })),
  }
}

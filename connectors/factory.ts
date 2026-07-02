import type {
  ActionDef, ActionResult, ActionRisk, ApiKeyAuth, ConnectorManifest, JSONSchema,
} from './types'

// ============================================================================
// REST connector factory.
//
// Most SaaS APIs are plain REST: base URL + auth header + JSON in/out. This
// factory turns a compact declarative spec into a full ConnectorManifest, so a
// new connector is ~80 lines of data instead of ~400 lines of hand-written
// fetch code. Simulation needs nothing extra — lib/sim-engine.ts AI-generates
// data for any connector from its action descriptions and schemas.
//
// Path templates use {param} placeholders (URL-encoded at call time). Params
// not used in the path are sent as query string for GET/DELETE and as a JSON
// body for POST/PUT/PATCH.
// ============================================================================

export interface ParamSpec {
  type?: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
  enum?: string[]
}

export interface RestActionSpec {
  slug: string
  name: string
  description: string
  risk: ActionRisk
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Path template, e.g. "/v2/tickets/{ticket_id}" */
  path: string
  params?: Record<string, ParamSpec>
  /** Fixed query-string params always sent (e.g. { limit: '50' }). */
  staticQuery?: Record<string, string>
  /** Extra per-action headers (e.g. AWS X-Amz-Target). */
  headers?: Record<string, string>
  /** Wrap the JSON body: (bodyParams) => actual body. Default: bodyParams as-is. */
  wrapBody?: (body: Record<string, unknown>) => unknown
}

export interface RestConnectorSpec {
  slug: string
  name: string
  category: string
  description: string
  /** Static base URL, or derive from credentials (e.g. per-tenant domains). */
  baseUrl: string | ((creds: Record<string, string>) => string)
  /** Build auth headers from stored credentials. */
  headers: (creds: Record<string, string>) => Record<string, string>
  auth: ApiKeyAuth
  /** GET path used by testConnection (may contain no placeholders). */
  testPath: string
  testLabel: string
  /** For POST-only APIs (e.g. GraphQL): override the test request. */
  testInit?: { method: 'POST'; body: unknown }
  /** Send write bodies as application/x-www-form-urlencoded (e.g. Stripe). */
  formEncoded?: boolean
  actions: RestActionSpec[]
}

function baseUrlOf(spec: RestConnectorSpec, creds: Record<string, string>): string {
  const raw = typeof spec.baseUrl === 'function' ? spec.baseUrl(creds) : spec.baseUrl
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/$/, '')
}

/** Authorization: Basic helper (e.g. Freshdesk-style "api_key:X"). */
export function basicAuth(user: string, pass = 'X'): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

function schemaOf(params: Record<string, ParamSpec> | undefined): JSONSchema {
  const properties: Record<string, JSONSchema> = {}
  const required: string[] = []
  for (const [key, p] of Object.entries(params ?? {})) {
    properties[key] = { type: p.type ?? 'string', description: p.description, ...(p.enum ? { enum: p.enum } : {}) }
    if (p.required) required.push(key)
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) }
}

async function restFetch(
  spec: RestConnectorSpec,
  creds: Record<string, string>,
  url: string,
  init: RequestInit,
): Promise<ActionResult> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...spec.headers(creds), ...(init.headers ?? {}) },
    })
    if (!res.ok) {
      const text = (await res.text().catch(() => res.statusText)).slice(0, 500)
      return { ok: false, error: `${spec.name} API error ${res.status}: ${text}` }
    }
    if (res.status === 204) return { ok: true, data: { status: 'ok' } }
    const text = await res.text()
    try { return { ok: true, data: text ? JSON.parse(text) : { status: 'ok' } } }
    catch { return { ok: true, data: { response: text.slice(0, 2000) } } }
  } catch (e) {
    return { ok: false, error: `${spec.name} request failed: ${String(e).slice(0, 300)}` }
  }
}

function buildAction(spec: RestConnectorSpec, a: RestActionSpec): ActionDef {
  const method = a.method ?? 'GET'
  return {
    slug: a.slug,
    name: a.name,
    description: a.description,
    risk: a.risk,
    inputSchema: schemaOf(a.params),
    execute: async (creds, params) => {
      const p = { ...(params ?? {}) } as Record<string, unknown>
      // Substitute {placeholders}; anything unfilled and required fails clearly.
      let path = a.path
      for (const m of a.path.matchAll(/\{(\w+)\}/g)) {
        const key = m[1]
        const v = p[key]
        if (v === undefined || v === null || v === '') {
          return { ok: false, error: `Missing required parameter "${key}" for ${a.name}.` }
        }
        path = path.replace(`{${key}}`, encodeURIComponent(String(v)))
        delete p[key]
      }
      const url = new URL(baseUrlOf(spec, creds) + path)
      for (const [k, v] of Object.entries(a.staticQuery ?? {})) url.searchParams.set(k, v)

      if (method === 'GET' || method === 'DELETE') {
        for (const [k, v] of Object.entries(p)) {
          if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
        }
        return restFetch(spec, creds, url.toString(), { method, headers: a.headers })
      }

      const body = a.wrapBody ? a.wrapBody(p) : p
      if (spec.formEncoded) {
        const form = new URLSearchParams()
        for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
          if (v !== undefined && v !== null) form.set(k, String(v))
        }
        return restFetch(spec, creds, url.toString(), {
          method, body: form.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(a.headers ?? {}) },
        })
      }
      return restFetch(spec, creds, url.toString(), { method, body: JSON.stringify(body), headers: a.headers })
    },
  }
}

/** Standard single-API-key auth block with a generic setup guide. */
export function apiKeyAuth(opts: {
  keyLabel?: string
  keyPlaceholder?: string
  keyHint?: string
  where: string        // e.g. "Settings → API → Personal access tokens"
  service: string
  fields?: ApiKeyAuth['fields']
}): ApiKeyAuth {
  return {
    type: 'api_key',
    keyLabel: opts.keyLabel ?? 'API Key',
    keyPlaceholder: opts.keyPlaceholder ?? `Your ${opts.service} API key`,
    keyHint: opts.keyHint ?? `Found in ${opts.service} → ${opts.where}.`,
    ...(opts.fields ? { fields: opts.fields } : {}),
    setupGuide: [
      { title: `Open ${opts.service}`, description: `Log in to your ${opts.service} account with an admin user.` },
      { title: 'Find your API credentials', description: `Go to **${opts.where}** and create or copy an API key/token.` },
      { title: 'Paste it here', description: 'Paste the key below and hit Connect — or choose **Simulate** to try this connector with realistic sample data and no keys at all.' },
    ],
  }
}

export function defineRestConnector(spec: RestConnectorSpec): ConnectorManifest {
  return {
    slug: spec.slug,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    logoUrl: `/logos/${spec.slug}.svg`,
    isSimulated: false,
    auth: spec.auth,
    testConnection: async (creds) => {
      const url = baseUrlOf(spec, creds) + spec.testPath
      const init: RequestInit = spec.testInit
        ? { method: spec.testInit.method, body: JSON.stringify(spec.testInit.body) }
        : { method: 'GET' }
      const result = await restFetch(spec, creds, url, init)
      return result.ok ? { ok: true, label: spec.testLabel } : { ok: false, error: result.error }
    },
    actions: spec.actions.map(a => buildAction(spec, a)),
  }
}

import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUrl } from '@/lib/runtime-config'

// Service-role client — bypasses RLS. Never expose to the browser.
// Always verify the caller's identity with the regular client first,
// then use this only for writes that require elevated access.
//
// serverSupabaseUrl() prefers SUPABASE_INTERNAL_URL so the self-hosted app
// container talks to its PostgREST sibling directly over the compose network,
// rather than looping back out through the public gateway.

/**
 * Logs the HTTP layer when a data request fails.
 *
 * supabase-js turns a non-2xx response into an `error` object built from the
 * response BODY. When the body is empty — which is what PostgREST returns for
 * an auth or permission rejection — that object ends up empty too: no message,
 * no code, nothing. The caller then reports a 500 it cannot explain, which is
 * exactly the dead end the self-hosted stack hit.
 *
 * So we log status, URL and body ourselves. Only failures are logged, and only
 * the response — never the request body, which would put credentials in the
 * log of a machine we don't control.
 */
async function loggingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (!res.ok) {
    // Read from a clone so the caller still gets an unconsumed body.
    const body = await res.clone().text().catch(() => '<unreadable>')
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    console.error(
      `[supabase-admin] ${init?.method ?? 'GET'} ${url} → ${res.status} ${res.statusText}` +
      ` · ${body.slice(0, 500) || '<empty body>'}`,
    )
  }
  return res
}

export function createAdminClient() {
  return createClient(
    serverSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: loggingFetch },
    }
  )
}

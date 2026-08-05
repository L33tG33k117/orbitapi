import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storeSecret } from '@/lib/credentials'
import { getConnector } from '@/connectors'

// Completes the OAuth2 flow: verifies state, exchanges the code for tokens, and
// stores them as a connection's credentials (same shape resolveCredentials reads,
// so connector execute() functions get creds.access_token / refresh_token).

function envKey(slug: string) {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function fail(req: Request, reason: string) {
  return NextResponse.redirect(new URL(`/connectors?oauth_error=${reason}`, req.url))
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Verify the CSRF state cookie set during /start.
  let saved: { state: string; slug: string; label: string } | null = null
  try {
    const raw = req.headers.get('cookie')?.match(/(?:^|;\s*)orbit_oauth=([^;]+)/)?.[1]
    if (raw) saved = JSON.parse(decodeURIComponent(raw))
  } catch { /* ignore */ }
  if (!code || !saved || saved.state !== state || saved.slug !== slug) return fail(req, 'state_mismatch')

  const manifest = getConnector(slug)
  if (!manifest || manifest.auth.type !== 'oauth2') return fail(req, 'bad_connector')

  const clientId = process.env[`OAUTH_${envKey(slug)}_CLIENT_ID`]
  const clientSecret = process.env[`OAUTH_${envKey(slug)}_CLIENT_SECRET`]
  if (!clientId || !clientSecret) return fail(req, 'not_configured')

  // Exchange the authorization code for tokens.
  let token: Record<string, unknown>
  try {
    const tokenRes = await fetch(manifest.auth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.origin}/api/oauth/${slug}/callback`,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!tokenRes.ok) return fail(req, 'token_exchange_failed')
    token = await tokenRes.json()
  } catch {
    return fail(req, 'token_exchange_failed')
  }

  const creds: Record<string, string> = {
    access_token: String(token.access_token ?? ''),
    refresh_token: String(token.refresh_token ?? ''),
    token_type: String(token.token_type ?? 'Bearer'),
    scope: String(token.scope ?? ''),
    expires_at: token.expires_in ? String(Date.now() + Number(token.expires_in) * 1000) : '',
  }
  if (!creds.access_token) return fail(req, 'no_access_token')

  const admin = createAdminClient()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return fail(req, 'forbidden')

  const { data: connectorRow } = await admin.from('connectors').select('id').eq('slug', slug).single()
  if (!connectorRow) return fail(req, 'connector_not_in_db')

  // Store tokens the same way /api/connections does.
  const vaultSecretId = await storeSecret(creds, `connection_${user.id}_${slug}_${Date.now()}`)

  const { data: connection } = await admin
    .from('connections')
    .insert({
      workspace_id: membership.workspace_id,
      connector_id: connectorRow.id,
      label: saved.label,
      vault_secret_id: vaultSecretId,
      is_simulated: false,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single()

  const res = NextResponse.redirect(new URL(connection ? `/connectors/${connection.id}` : '/connectors?oauth=connected', req.url))
  res.cookies.set('orbit_oauth', '', { maxAge: 0, path: '/' })
  return res
}

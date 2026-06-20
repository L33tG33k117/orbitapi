import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConnector } from '@/connectors'

// Begins the OAuth2 authorization-code flow for an OAuth-type connector.
// Provider client credentials come from env: OAUTH_<SLUG>_CLIENT_ID /
// OAUTH_<SLUG>_CLIENT_SECRET (slug upper-snake-cased, e.g. google-drive →
// OAUTH_GOOGLE_DRIVE_CLIENT_ID). Additive: only OAuth connectors hit this.

function envKey(slug: string) {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const manifest = getConnector(slug)
  if (!manifest || manifest.auth.type !== 'oauth2') {
    return NextResponse.json({ error: 'This connector does not use OAuth.' }, { status: 400 })
  }

  const clientId = process.env[`OAUTH_${envKey(slug)}_CLIENT_ID`]
  if (!clientId) {
    return NextResponse.json(
      { error: `OAuth is not configured for ${manifest.name}. Set OAUTH_${envKey(slug)}_CLIENT_ID and _CLIENT_SECRET.` },
      { status: 501 },
    )
  }

  const origin = new URL(req.url).origin
  const label = new URL(req.url).searchParams.get('label') || manifest.name
  const state = crypto.randomUUID()

  const authUrl = new URL(manifest.auth.authUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', `${origin}/api/oauth/${slug}/callback`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', manifest.auth.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline') // request a refresh token where supported
  authUrl.searchParams.set('prompt', 'consent')

  const res = NextResponse.redirect(authUrl.toString())
  // CSRF: state + intent travel in an httpOnly cookie, verified on callback.
  res.cookies.set('orbit_oauth', JSON.stringify({ state, slug, label }), {
    httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600, path: '/',
  })
  return res
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { serverSupabaseUrl } from '@/lib/runtime-config'
import { needsFirstRunSetup } from '@/lib/setup-state'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    serverSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuth = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup')
  // Server-to-server routes authenticate themselves (webhook token + HMAC,
  // Stripe signature, CRON_SECRET, MCP token). External senders have no
  // Supabase session, so redirecting them to /login breaks them.
  const isServerToServer = url.pathname.startsWith('/api/hooks/')
    || url.pathname.startsWith('/api/mcp/')
    || url.pathname.startsWith('/api/cron/')
    || url.pathname.startsWith('/api/billing/webhook')
    || url.pathname.startsWith('/api/webhooks/skills/')
    // The release workflow catalogues a build with a shared secret and no
    // session. A redirect here is worse than a failure: curl treats the 307 as
    // success, so the release would look published while nothing was recorded
    // and no customer could see it.
    || url.pathname === '/api/selfhost/releases/register'
    // The container healthcheck runs before anyone has logged in, and gets no
    // session. Redirecting it to /login would report a broken app as healthy.
    || url.pathname === '/api/health'
  const isPublic = url.pathname === '/' || isAuth || isServerToServer
    || url.pathname.startsWith('/api/auth')
    || url.pathname.startsWith('/privacy')
    || url.pathname.startsWith('/terms')
    || url.pathname.startsWith('/contact')
    // The contact form is for people who don't have an account yet — that's
    // most of the point. The page was already public but the endpoint behind
    // it wasn't, so every submission redirected to /login.
    || url.pathname === '/api/contact'
    || url.pathname.startsWith('/demo')
    || url.pathname.startsWith('/how-it-works')
    || url.pathname.startsWith('/integrations')
    || url.pathname.startsWith('/solutions')
    || url.pathname.startsWith('/self-hosted')
    || url.pathname.startsWith('/changelog')
    || url.pathname.startsWith('/opengraph-image')
    // The first-run wizard has to be reachable before any account exists.
    // /api/setup refuses to do anything once one does, so this is safe.
    || url.pathname === '/setup'
    || url.pathname === '/api/setup'

  // A brand-new self-hosted install has no accounts and no way to make one:
  // public signup is disabled on the auth service, and there is no admin yet
  // to send an invite. Send the first VISITOR to the wizard instead of a login
  // page they can never get past. needsFirstRunSetup() is cached and latches
  // shut for good once an account exists.
  //
  // Only page navigations are redirected. Redirecting /api/* here broke the
  // container healthcheck — /api/health answered 307, so the app never became
  // healthy, so `orbit.sh install` waited forever on a stack that was actually
  // running fine. Nothing that speaks JSON wants an HTML wizard anyway.
  const isApiRequest = url.pathname.startsWith('/api/')
  if (!user && !isApiRequest && url.pathname !== '/setup') {
    if (await needsFirstRunSetup()) {
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
  }

  if (!user && !isPublic) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuth) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

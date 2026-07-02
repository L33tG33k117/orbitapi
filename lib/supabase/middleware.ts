import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const isPublic = url.pathname === '/' || isAuth || isServerToServer
    || url.pathname.startsWith('/api/auth')
    || url.pathname.startsWith('/privacy')
    || url.pathname.startsWith('/terms')
    || url.pathname.startsWith('/contact')
    || url.pathname.startsWith('/demo')
    || url.pathname.startsWith('/how-it-works')
    || url.pathname.startsWith('/integrations')
    || url.pathname.startsWith('/solutions')
    || url.pathname.startsWith('/changelog')
    || url.pathname.startsWith('/opengraph-image')

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

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ============================================================
// Proxy (Next 16): rate limiting + Supabase session refresh
// ============================================================
// Rate limiting runs first and only for /api routes. It stops a single client
// or a runaway loop from hammering the API, exhausting the DB pool, or burning
// AI credits. Fail-open: any limiter error lets the request through, so a bug
// here can never take the app down.
//
// NOTE: state is per server instance — a cheap first layer, not the last word.
// For hardened, distributed limits use Vercel WAF rate rules or a shared store
// (Upstash / Vercel KV).
// ============================================================

const WINDOW_MS = 10_000
const GENERAL_MAX = 150   // all API calls per IP per 10s
const EXPENSIVE_MAX = 15  // AI / build / install routes per IP per 10s

type Bucket = { count: number; reset: number }
const buckets = new Map<string, Bucket>()

// AI- or write-heavy routes that deserve a tighter cap.
const EXPENSIVE = /^\/api\/(chat|execute|bundles\/install|skills\/[^/]+\/(run|verify)|admin\/connector-requests\/[^/]+)/

function over(key: string, max: number, now: number): boolean {
  const b = buckets.get(key)
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  b.count += 1
  return b.count > max
}

function rateLimited(request: NextRequest): Response | null {
  try {
    const path = request.nextUrl.pathname
    if (!path.startsWith('/api/')) return null

    const now = Date.now()
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k)
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    const expensive = EXPENSIVE.test(path)
    const key = `${ip}:${expensive ? 'x' : 'g'}`

    if (over(key, expensive ? EXPENSIVE_MAX : GENERAL_MAX, now)) {
      return Response.json(
        { error: 'Too many requests — please slow down and try again in a moment.' },
        { status: 429, headers: { 'Retry-After': '10' } },
      )
    }
  } catch {
    /* fail open */
  }
  return null
}

export async function proxy(request: NextRequest) {
  const limited = rateLimited(request)
  if (limited) return limited
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

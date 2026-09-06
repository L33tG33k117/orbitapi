import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'

export const dynamic = 'force-dynamic'

/**
 * Catalogue a freshly-published bundle.
 *
 * Called by .github/workflows/release.yml after it has built, signed and
 * uploaded the tarball to Blob. Cutting a `selfhost-v*` tag stays the single
 * action that publishes a release — this is the last step of it, not a
 * separate chore to remember.
 *
 * Authenticated by a shared secret rather than a user session, because CI has
 * no user. Fails closed: no RELEASE_REGISTRY_SECRET means nothing can register,
 * which is the right default for a route that decides what customers install.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.RELEASE_REGISTRY_SECRET
  if (!expected) return false

  const provided = req.headers.get('x-release-secret') ?? ''

  // Constant-time, and length-guarded because timingSafeEqual throws on a
  // length mismatch — which would itself leak the expected length via a 500.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (isSelfHost()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    version?: string
    blobUrl?: string
    sha256?: string
    sizeBytes?: number
    changelog?: string
    channel?: string
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { version, blobUrl, sha256 } = body
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    return NextResponse.json({ error: 'A semver version is required.' }, { status: 400 })
  }
  if (!blobUrl || !blobUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'A https bundle URL is required.' }, { status: 400 })
  }
  if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) {
    return NextResponse.json({ error: 'A hex sha256 digest is required.' }, { status: 400 })
  }

  const channel = body.channel === 'beta' ? 'beta' : 'stable'

  const admin = createAdminClient()

  // Upsert on version: re-running a release job for the same tag should correct
  // the row rather than 409 and leave CI red over a retry.
  const { error } = await admin
    .from('selfhost_releases')
    .upsert({
      version,
      blob_url: blobUrl,
      sha256,
      size_bytes: body.sizeBytes ?? null,
      changelog: body.changelog ?? null,
      channel,
      yanked: false,
    }, { onConflict: 'version' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, version })
}

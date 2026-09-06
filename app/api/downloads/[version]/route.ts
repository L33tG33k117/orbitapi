import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSelfhostAccess } from '@/lib/selfhost-access'
import { isSelfHost } from '@/lib/edition'

export const dynamic = 'force-dynamic'

/**
 * Hand over a bundle.
 *
 * Entitlement is checked here, then the request is redirected to the blob.
 * It is NOT proxied: these bundles are several hundred megabytes of Docker
 * images, and streaming that through a serverless function would burn the
 * execution limit long before the download finished, on every attempt.
 *
 * The consequence, stated plainly because it should be a decision and not an
 * accident: the redirect target is a bearer URL. It is unguessable and never
 * appears in the catalogue response, so it can only be obtained by an entitled
 * user asking for it — but once obtained it could be pasted to someone else.
 * That is an acceptable trade here, for the same reason licence key copying is
 * (lib/license.ts): the bundle is useless without a signed licence, and the
 * licence is the thing that is actually sold.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  if (isSelfHost()) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  const { version } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getSelfhostAccess(user.id, user.email)
  // 404 rather than 403: an unentitled visitor learns nothing about whether a
  // given version exists.
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: release, error } = await admin
    .from('selfhost_releases')
    .select('version, blob_url, yanked')
    .eq('version', version)
    .maybeSingle()

  if (error || !release || release.yanked) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Best-effort audit. A logging failure must never block a customer's
  // download — support can live without one line; a customer stuck on an
  // air-gapped install at 2am cannot.
  await admin.from('selfhost_download_log').insert({
    customer_id: access.customerId,
    user_id: user.id,
    version: release.version,
  }).then(undefined, () => {})

  return NextResponse.redirect(release.blob_url, 302)
}

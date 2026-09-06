import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSelfhostAccess, listReleases } from '@/lib/selfhost-access'
import { isSelfHost } from '@/lib/edition'

export const dynamic = 'force-dynamic'

/**
 * What may this user download?
 *
 * Returns the catalogue only — never a bundle URL. The URL is minted per
 * download by /api/downloads/[version], so a link cannot be copied out of a
 * JSON response and handed around.
 */
export async function GET() {
  // Nothing to serve from inside an installation: this is the page you visit
  // on the cloud, from a machine that has internet.
  if (isSelfHost()) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getSelfhostAccess(user.id, user.email)
  if (!access) return NextResponse.json({ entitled: false, releases: [] })

  const releases = await listReleases()

  return NextResponse.json({
    entitled: true,
    company: access.company,
    licenseExpiresAt: access.licenseExpiresAt,
    licenseId: access.licenseId,
    releases: releases.map(r => ({
      version: r.version,
      sizeBytes: r.size_bytes,
      sha256: r.sha256,
      changelog: r.changelog,
      publishedAt: r.published_at,
    })),
  })
}

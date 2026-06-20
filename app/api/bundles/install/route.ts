import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { installBundle, type BundleManifest } from '@/lib/bundles'
import { getBuiltinBundle } from '@/lib/bundle-registry'
import { capabilityGuard } from '@/lib/workspace-features'

export const maxDuration = 120

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const denied = await capabilityGuard('bundles')
  if (denied) return denied

  const { slug, source, resolutions } = await req.json()
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  let manifest: BundleManifest | undefined
  let listingId: string | null = null

  if (source === 'marketplace') {
    const admin = createAdminClient()
    const { data: listing } = await admin
      .from('marketplace_listings')
      .select('id, manifest, status')
      .eq('slug', slug)
      .eq('status', 'approved')
      .single()
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    manifest = listing.manifest as BundleManifest
    listingId = listing.id
  } else {
    manifest = getBuiltinBundle(slug)
  }

  if (!manifest) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })

  try {
    const result = await installBundle({
      manifest,
      workspaceId: membership.workspace_id,
      userId: user.id,
      source: source === 'marketplace' ? 'marketplace' : 'builtin',
      listingId,
      resolutions: resolutions ?? undefined,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[bundle install]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { compareVersions } from '@/lib/version'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('selfhost_releases')
    .select('version, size_bytes, sha256, changelog, channel, yanked, published_at')
    .order('published_at', { ascending: false })
    .limit(100)

  // Graceful before 056, same as the customers list.
  if (error) return NextResponse.json([])

  // Newest by version, not by publish date — a patch to an older line shipped
  // last is not the newest build, and showing it at the top of an admin list is
  // how someone ends up telling a customer to install the wrong thing.
  const sorted = (data ?? []).sort((a, b) => compareVersions(b.version, a.version))
  return NextResponse.json(sorted)
}

export async function PATCH(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { version, yanked } = await req.json().catch(() => ({})) as { version?: string; yanked?: boolean }
  if (!version || typeof yanked !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('selfhost_releases').update({ yanked }).eq('version', version)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

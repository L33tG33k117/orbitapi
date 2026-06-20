import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uninstallBundle } from '@/lib/bundles'

// Removes everything a bundle installed (skills, playbooks, groups, and the
// connections it created — reused/pre-existing connections are left untouched).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await req.json()
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  try {
    await uninstallBundle({ workspaceId: membership.workspace_id, bundleSlug: slug })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bundle uninstall]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

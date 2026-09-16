import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { getSelfhostAccess } from '@/lib/selfhost-access'
import { logAuditEvent } from '@/lib/audit'

// POST { enabled: boolean } — switch this cloud workspace into or out of
// offline mode. Only for owners/admins who hold a self-hosted (Enterprise)
// licence. Offline and online are exclusive: while offline, the online product
// is paused for this workspace (see lib/offline-paths.ts).
export async function POST(req: Request) {
  if (isSelfHost()) {
    return NextResponse.json({ error: 'not_available', message: 'This installation is already the offline edition.' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
  }

  // Turning it ON needs a self-hosted licence; turning it OFF is always allowed
  // so nobody can get stuck (e.g. after a licence lapses).
  if (body.enabled && !(await getSelfhostAccess(user.id, user.email))) {
    return NextResponse.json(
      { error: 'plan_required', message: 'Offline mode is part of OrbitAPI Enterprise (self-hosted).' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from('workspaces').update({
    offline_mode: body.enabled,
    offline_mode_changed_at: new Date().toISOString(),
    offline_mode_changed_by: user.id,
  }).eq('id', membership.workspace_id)
  if (error) {
    return NextResponse.json({ error: 'Could not change offline mode. Has migration 059 been applied?', detail: error.message }, { status: 500 })
  }

  await logAuditEvent({
    workspaceId: membership.workspace_id, userId: user.id, actorEmail: user.email,
    category: 'workspace', action: body.enabled ? 'workspace.offline_on' : 'workspace.offline_off',
    summary: body.enabled
      ? 'Switched this workspace to offline mode (online connections and automations paused)'
      : 'Switched this workspace back to online mode',
  })

  return NextResponse.json({ ok: true, offline_mode: body.enabled })
}

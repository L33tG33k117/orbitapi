import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

type Params = { params: Promise<{ workspaceId: string }> }

// PATCH — rename workspace (owner only) and/or update the connection-deletion
// policy (owner or admin).
export async function PATCH(req: Request, { params }: Params) {
  const { workspaceId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const isAdmin = membership.role === 'owner' || membership.role === 'admin'

  const body = await req.json()
  const { name, connectionDeleteDefault, connectionDeleteLocked } = body as {
    name?: string
    connectionDeleteDefault?: 'trash' | 'permanent'
    connectionDeleteLocked?: boolean
  }

  const updates: Record<string, unknown> = {}

  if (name !== undefined) {
    if (membership.role !== 'owner') return NextResponse.json({ error: 'Only the workspace owner can rename it' }, { status: 403 })
    if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    updates.name = name.trim()
  }

  if (connectionDeleteDefault !== undefined || connectionDeleteLocked !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Only admins can change the deletion policy' }, { status: 403 })
    if (connectionDeleteDefault !== undefined) {
      if (!['trash', 'permanent'].includes(connectionDeleteDefault)) return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
      updates.connection_delete_default = connectionDeleteDefault
    }
    if (connectionDeleteLocked !== undefined) updates.connection_delete_locked = !!connectionDeleteLocked
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('workspaces').update(updates).eq('id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Governance trail — record the specific workspace settings that changed.
  const ctx = { workspaceId, userId: user.id, actorEmail: user.email, category: 'workspace' as const }
  if (updates.name !== undefined) {
    await logAuditEvent({ ...ctx, action: 'workspace.renamed', summary: `Renamed the workspace to “${updates.name}”` })
  }
  if (updates.connection_delete_default !== undefined || updates.connection_delete_locked !== undefined) {
    await logAuditEvent({ ...ctx, action: 'workspace.delete_policy_changed',
      summary: `Updated the connection-deletion policy${updates.connection_delete_default ? ` (default: ${updates.connection_delete_default})` : ''}${updates.connection_delete_locked !== undefined ? `, ${updates.connection_delete_locked ? 'locked' : 'unlocked'}` : ''}`,
      metadata: { connection_delete_default: updates.connection_delete_default, connection_delete_locked: updates.connection_delete_locked } })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — delete workspace (owner only, destructive)
export async function DELETE(_req: Request, { params }: Params) {
  const { workspaceId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('workspaces').delete().eq('id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

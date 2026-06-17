import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — fetch sandbox workspace + snapshot list for the current super admin
export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ data: membership }, { data: snapshots }] = await Promise.all([
    admin
      .from('memberships')
      .select('workspace_id, workspaces(id, name, is_sandbox, created_at)')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('workspaces.is_sandbox', true)
      .maybeSingle(),
    admin
      .from('sandbox_snapshots')
      .select('id, name, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspace = (membership as any)?.workspaces ?? null

  return NextResponse.json({ workspace, snapshots: snapshots ?? [] })
}

// POST — create sandbox workspace if it doesn't exist yet
export async function POST() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Check if sandbox workspace already exists for this user
  const { data: existing } = await admin
    .from('memberships')
    .select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter('workspaces.is_sandbox', 'eq', true as any)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((existing as any)?.workspaces) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ workspace: (existing as any).workspaces, alreadyExisted: true })
  }

  // Get the user's profile for the workspace name
  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()
  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Super Admin'

  // Create sandbox workspace
  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: `${displayName}'s Sandbox`, tier: 'pro', is_sandbox: true })
    .select()
    .single()

  if (wsErr || !workspace) return NextResponse.json({ error: wsErr?.message ?? 'Failed to create workspace' }, { status: 500 })

  // Add super admin as owner
  const { error: memErr } = await admin
    .from('memberships')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  return NextResponse.json({ workspace, alreadyExisted: false })
}

// DELETE — reset sandbox: wipe all connections and skills in the sandbox workspace
export async function DELETE(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify this workspace belongs to this super admin and is a sandbox
  const { data: ws } = await admin
    .from('workspaces')
    .select('id, is_sandbox')
    .eq('id', workspaceId)
    .eq('is_sandbox', true)
    .single()

  if (!ws) return NextResponse.json({ error: 'Sandbox workspace not found' }, { status: 404 })

  const { data: membership } = await admin
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (membership?.role !== 'owner') return NextResponse.json({ error: 'Not the owner of this sandbox' }, { status: 403 })

  // Delete in cascade order
  await Promise.all([
    admin.from('connections').delete().eq('workspace_id', workspaceId),
    admin.from('skills').delete().eq('workspace_id', workspaceId),
    admin.from('groups').delete().eq('workspace_id', workspaceId),
    admin.from('conversations').delete().eq('workspace_id', workspaceId),
  ])

  return NextResponse.json({ ok: true, reset: true, workspaceId })
}

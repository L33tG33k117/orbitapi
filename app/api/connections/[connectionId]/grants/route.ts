import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ connectionId: string }> }

// GET — list grants + workspace members for this connection (admins/owners only)
export async function GET(_req: Request, { params }: Params) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: connection } = await admin
    .from('connections')
    .select('workspace_id')
    .eq('id', connectionId)
    .single()
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Must be admin/owner of this workspace
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: members }, { data: grants }] = await Promise.all([
    admin
      .from('memberships')
      .select('user_id, role, profile:profiles(email, full_name)')
      .eq('workspace_id', connection.workspace_id)
      .eq('role', 'member'),
    admin
      .from('connection_grants')
      .select('user_id, level')
      .eq('connection_id', connectionId),
  ])

  return NextResponse.json({ members: members ?? [], grants: grants ?? [] })
}

// POST { userId, level } — upsert a grant
export async function POST(req: Request, { params }: Params) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, level } = await req.json()
  if (!userId || !['read', 'read_write'].includes(level)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: connection } = await admin
    .from('connections')
    .select('workspace_id')
    .eq('id', connectionId)
    .single()
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin
    .from('connection_grants')
    .upsert({ connection_id: connectionId, user_id: userId, level }, { onConflict: 'connection_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return new Response(null, { status: 204 })
}

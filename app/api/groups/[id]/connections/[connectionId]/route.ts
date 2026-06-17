import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string; connectionId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id: groupId, connectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: group } = await admin.from('groups').select('workspace_id').eq('id', groupId).single()
  if (!group || group.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await admin.from('group_connections')
    .delete()
    .eq('group_id', groupId)
    .eq('connection_id', connectionId)

  return new Response(null, { status: 204 })
}

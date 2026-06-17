import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ connectionId: string; userId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { connectionId, userId } = await params

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

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin
    .from('connection_grants')
    .delete()
    .eq('connection_id', connectionId)
    .eq('user_id', userId)

  return new Response(null, { status: 204 })
}

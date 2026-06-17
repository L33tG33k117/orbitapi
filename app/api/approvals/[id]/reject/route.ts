import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  if (membership.role === 'member') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: pending } = await admin
    .from('pending_actions')
    .select('id, status, workspace_id')
    .eq('id', id)
    .eq('workspace_id', membership.workspace_id)
    .single()

  if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pending.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  await admin.from('pending_actions').update({ status: 'rejected' }).eq('id', id)
  return NextResponse.json({ ok: true })
}

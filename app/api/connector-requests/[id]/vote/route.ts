import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Confirm request exists and isn't rejected
  const { data: request } = await admin
    .from('connector_requests')
    .select('id, status, user_id')
    .eq('id', id)
    .neq('status', 'rejected')
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.user_id === user.id) {
    return NextResponse.json({ error: 'You already own this request', already_voted: true })
  }

  const { error } = await admin.from('connector_request_votes').insert({
    request_id: id,
    user_id: user.id,
    workspace_id: membership.workspace_id,
  })

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Already voted', already_voted: true }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: updated } = await admin
    .from('connector_requests')
    .select('vote_count')
    .eq('id', id)
    .single()

  return NextResponse.json({ ok: true, vote_count: updated?.vote_count })
}

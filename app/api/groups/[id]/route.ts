import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

async function getGroupAndCheck(id: string, user: { id: string }, requireAdmin = false) {
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership) return { error: 'No workspace', status: 403 as const }
  if (requireAdmin && membership.role === 'member') return { error: 'Forbidden', status: 403 as const }

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('groups')
    .select('*, group_connections(connection_id), skills(id, name)')
    .eq('id', id)
    .single()

  if (!group) return { error: 'Not found', status: 404 as const }
  if (group.workspace_id !== membership.workspace_id) return { error: 'Forbidden', status: 403 as const }

  return { group, membership, admin }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getGroupAndCheck(id, user)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.group)
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getGroupAndCheck(id, user, true)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const body = await req.json()
  const { error } = await result.admin
    .from('groups')
    .update({ name: body.name, description: body.description, color: body.color })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getGroupAndCheck(id, user, true)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  await result.admin.from('groups').delete().eq('id', id)
  return new Response(null, { status: 204 })
}

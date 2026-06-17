import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: messages } = await admin
    .from('connector_request_messages')
    .select('id, sender_type, sender_id, content, created_at, read_at')
    .eq('request_id', id)
    .order('created_at')

  const senderIds = [...new Set((messages ?? []).map(m => m.sender_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', senderIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const enriched = (messages ?? []).map(m => ({ ...m, sender: profileMap[m.sender_id] ?? null }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch the request so we can notify the original submitter
  const { data: request } = await admin
    .from('connector_requests')
    .select('id, connector_name, user_id, workspace_id')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const { data, error } = await admin
    .from('connector_request_messages')
    .insert({ request_id: id, sender_type: 'admin', sender_id: user.id, content: content.trim() })
    .select('id, sender_type, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the user who submitted the request
  await createNotification({
    workspaceId: request.workspace_id,
    userId: request.user_id,
    type: 'info',
    title: `Message on your "${request.connector_name}" connector request`,
    body: content.trim().slice(0, 120),
    link: '/connectors/requests',
  })

  return NextResponse.json(data)
}

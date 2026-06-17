import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify the user owns this request
  const { data: request } = await admin
    .from('connector_requests')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await admin
    .from('connector_request_messages')
    .select('id, sender_type, content, created_at, read_at')
    .eq('request_id', id)
    .order('created_at')

  // Mark unread admin messages as read
  const unreadIds = (messages ?? [])
    .filter(m => m.sender_type === 'admin' && !m.read_at)
    .map(m => m.id)

  if (unreadIds.length > 0) {
    await admin
      .from('connector_request_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }

  return NextResponse.json(messages ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the user owns this request
  const { data: request } = await admin
    .from('connector_requests')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await admin
    .from('connector_request_messages')
    .insert({ request_id: id, sender_type: 'user', sender_id: user.id, content: content.trim() })
    .select('id, sender_type, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

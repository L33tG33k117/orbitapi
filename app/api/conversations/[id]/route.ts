import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/conversations/[id] — get messages for a conversation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()

  // Verify ownership
  const { data: convo } = await admin
    .from('conversations').select('id, user_id, title').eq('id', id).single()
  if (!convo || convo.user_id !== user.id) return new Response('Not found', { status: 404 })

  const { data: messages, error } = await admin
    .from('conversation_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ conversation: convo, messages: messages ?? [] })
}

// POST /api/conversations/[id] — append messages to a conversation.
// The chat UI generates the conversation id client-side and never calls
// POST /api/conversations to create the row first, so this endpoint creates
// the conversation on first write (upsert) — otherwise history stays empty.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const messages: Array<{ role: string; content: string }> = body.messages ?? []
  const autoTitle: string | undefined = body.autoTitle

  if (!messages.length) return Response.json({ ok: true })

  // Find the conversation; create it on first write if it doesn't exist yet.
  const { data: convo } = await admin
    .from('conversations').select('id, user_id, title').eq('id', id).single()

  if (convo) {
    if (convo.user_id !== user.id) return new Response('Not found', { status: 404 })
  } else {
    const { data: membership } = await supabase
      .from('memberships').select('workspace_id').eq('user_id', user.id).single()
    if (!membership) return new Response('No workspace', { status: 403 })

    const { error: createErr } = await admin.from('conversations').insert({
      id,
      workspace_id: membership.workspace_id,
      user_id: user.id,
      title: autoTitle ? autoTitle.slice(0, 100) : null,
    })
    if (createErr) return Response.json({ error: createErr.message }, { status: 500 })
  }

  const rows = messages.map(m => ({
    conversation_id: id,
    role: m.role,
    content: m.content,
  }))

  const { error } = await admin.from('conversation_messages').insert(rows)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Set title from first user message if not set yet, and bump updated_at so
  // the conversation sorts to the top of the history list.
  const titleUpdate = !convo?.title && autoTitle ? { title: autoTitle.slice(0, 100) } : {}
  await admin.from('conversations')
    .update({ ...titleUpdate, updated_at: new Date().toISOString() })
    .eq('id', id)

  return Response.json({ ok: true })
}

// DELETE /api/conversations/[id] — delete a conversation
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()
  const { data: convo } = await admin
    .from('conversations').select('id, user_id').eq('id', id).single()
  if (!convo || convo.user_id !== user.id) return new Response('Not found', { status: 404 })

  await admin.from('conversations').delete().eq('id', id)
  return Response.json({ ok: true })
}

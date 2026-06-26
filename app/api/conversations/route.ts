import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/conversations — list conversations for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return new Response('No workspace', { status: 403 })

  const admin = createAdminClient()
  const primary = await admin
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('workspace_id', membership.workspace_id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  let rows: { id: string; title: string | null; created_at: string; updated_at: string }[] | null = primary.data
  let err = primary.error

  // Resilient to pre-migration-040 schemas that lack updated_at — fall back to
  // created_at so history loads instead of 500-ing.
  if (err && /updated_at/i.test(err.message)) {
    const fb = await admin
      .from('conversations')
      .select('id, title, created_at')
      .eq('workspace_id', membership.workspace_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    err = fb.error
    rows = (fb.data ?? []).map(c => ({ ...c, updated_at: c.created_at }))
  }

  if (err) return Response.json({ error: err.message }, { status: 500 })

  // Hide empty conversations — legacy shells (created before messages persisted)
  // and any that never got a saved message would otherwise open to a blank pane.
  const ids = (rows ?? []).map(r => r.id)
  if (ids.length) {
    const { data: msgRows } = await admin
      .from('conversation_messages')
      .select('conversation_id')
      .in('conversation_id', ids)
    const withMessages = new Set((msgRows ?? []).map(m => m.conversation_id))
    rows = (rows ?? []).filter(r => withMessages.has(r.id))
  }

  return Response.json(rows ?? [])
}

// POST /api/conversations — create a new conversation
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return new Response('No workspace', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const title: string | undefined = body.title

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('conversations')
    .insert({ workspace_id: membership.workspace_id, user_id: user.id, title: title ?? null })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

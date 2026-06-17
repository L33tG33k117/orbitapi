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
  const { data, error } = await admin
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('workspace_id', membership.workspace_id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
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

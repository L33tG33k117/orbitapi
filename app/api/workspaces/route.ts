import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({ name: z.string().min(1).max(80) })

export async function POST(request: Request) {
  // Auth check via regular client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  // Workspace + membership writes use admin client (service role)
  const admin = createAdminClient()

  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: parsed.data.name })
    .select()
    .single()

  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })

  const { error: memErr } = await admin
    .from('memberships')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  return NextResponse.json({ workspace }, { status: 201 })
}

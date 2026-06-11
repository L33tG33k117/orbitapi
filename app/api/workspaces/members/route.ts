import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId, email, role } = parsed.data

  // Verify caller is owner/admin of this workspace
  const { data: callerMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!callerMembership || callerMembership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Look up the invitee by email via admin API — requires service role
  const adminSupabase = await createClient()
  const { data: invitee } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!invitee) {
    return NextResponse.json({ error: 'No user found with that email. They must sign up first.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('memberships')
    .upsert({ workspace_id: workspaceId, user_id: invitee.id, role }, { onConflict: 'workspace_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

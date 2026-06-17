import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

type Params = { params: Promise<{ id: string }> }

// POST — generate (or regenerate) a webhook secret for this skill
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: skill } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!skill || skill.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const secret = randomBytes(24).toString('hex')
  await admin.from('skills').update({ webhook_secret: secret }).eq('id', id)

  return NextResponse.json({ webhook_secret: secret })
}

// DELETE — revoke the webhook secret
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  await admin.from('skills').update({ webhook_secret: null }).eq('id', id)
  return new Response(null, { status: 204 })
}

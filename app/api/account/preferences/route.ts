import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    connection_delete_preference?: 'trash' | 'permanent'
    email_skill_notifications?: 'off' | 'failures' | 'all'
  }

  const update: Record<string, string> = {}

  if (body.connection_delete_preference !== undefined) {
    if (!['trash', 'permanent'].includes(body.connection_delete_preference)) {
      return NextResponse.json({ error: 'Invalid preference value' }, { status: 400 })
    }
    update.connection_delete_preference = body.connection_delete_preference
  }

  if (body.email_skill_notifications !== undefined) {
    if (!['off', 'failures', 'all'].includes(body.email_skill_notifications)) {
      return NextResponse.json({ error: 'Invalid preference value' }, { status: 400 })
    }
    update.email_skill_notifications = body.email_skill_notifications
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid preference provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

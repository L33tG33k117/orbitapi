import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, pageUrl } = await req.json() as { message?: string; pageUrl?: string }
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()

  const admin = createAdminClient()
  const { error } = await admin.from('feedback').insert({
    workspace_id: membership?.workspace_id ?? null,
    user_id: user.id,
    message: message.trim().slice(0, 5000),
    page_url: pageUrl ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

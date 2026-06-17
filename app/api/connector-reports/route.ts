import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const { connector_slug, connector_name, what_wrong, error_message } = await req.json()
  if (!connector_slug?.trim() || !what_wrong?.trim()) {
    return NextResponse.json({ error: 'connector_slug and what_wrong are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('connector_reports')
    .insert({
      connector_slug: connector_slug.trim(),
      connector_name: connector_name?.trim() ?? connector_slug.trim(),
      user_id: user.id,
      workspace_id: membership.workspace_id,
      what_wrong: what_wrong.trim(),
      error_message: error_message?.trim() ?? null,
    })
    .select('id, connector_slug, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

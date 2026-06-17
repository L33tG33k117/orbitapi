import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  if (membership.role === 'member') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pending_actions')
    .select('id, action_slug, params, summary, status, expires_at, created_at, user_id, connection:connections(id, label, connector:connectors(slug, name))')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with requester emails
  const userIds = [...new Set((data ?? []).map(a => a.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const enriched = (data ?? []).map(a => ({ ...a, requester: profileMap[a.user_id] ?? null }))

  return NextResponse.json(enriched)
}

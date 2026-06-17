import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // connector_requests.user_id → auth.users, not profiles, so PostgREST can't auto-join profiles
  const { data: requests, error } = await admin
    .from('connector_requests')
    .select('id, connector_name, use_case, status, admin_notes, created_at, updated_at, workspace_id, user_id, workspace:workspaces(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!requests?.length) return NextResponse.json([])

  // Fetch profiles for all unique user_ids
  const userIds = [...new Set(requests.map(r => r.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const enriched = requests.map(r => ({
    ...r,
    profile: profileMap[r.user_id] ?? null,
  }))

  return NextResponse.json(enriched)
}

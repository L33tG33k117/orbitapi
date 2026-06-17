import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('connector_reports')
    .select('id, connector_slug, connector_name, what_wrong, error_message, status, admin_note, created_at, user_id, workspace_id')
    .order('created_at', { ascending: false })
    .limit(100)

  // Enrich with user profiles and workspace names
  const userIds = [...new Set((data ?? []).map(r => r.user_id))]
  const workspaceIds = [...new Set((data ?? []).map(r => r.workspace_id))]

  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    admin.from('profiles').select('id, email, full_name').in('id', userIds),
    admin.from('workspaces').select('id, name').in('id', workspaceIds),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const workspaceMap = Object.fromEntries((workspaces ?? []).map(w => [w.id, w]))

  const enriched = (data ?? []).map(r => ({
    ...r,
    profile: profileMap[r.user_id] ?? null,
    workspace: workspaceMap[r.workspace_id] ?? null,
  }))

  return NextResponse.json(enriched)
}

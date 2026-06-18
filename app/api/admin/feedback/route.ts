import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // feedback.user_id references auth.users (not profiles), so we can't embed
  // profiles directly — fetch the rows, then resolve profiles/workspaces by id.
  const { data: rows } = await admin
    .from('feedback')
    .select('id, message, page_url, status, created_at, user_id, workspace_id')
    .order('created_at', { ascending: false })
    .limit(200)

  const list = rows ?? []
  const userIds = [...new Set(list.map(r => r.user_id).filter(Boolean))] as string[]
  const wsIds = [...new Set(list.map(r => r.workspace_id).filter(Boolean))] as string[]

  const [profilesRes, workspacesRes] = await Promise.all([
    userIds.length ? admin.from('profiles').select('id, email, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
    wsIds.length ? admin.from('workspaces').select('id, name').in('id', wsIds) : Promise.resolve({ data: [] }),
  ])

  const pMap = new Map((profilesRes.data ?? []).map(p => [p.id, { email: p.email, full_name: p.full_name }]))
  const wMap = new Map((workspacesRes.data ?? []).map(w => [w.id, { name: w.name }]))

  const enriched = list.map(r => ({
    id: r.id,
    message: r.message,
    page_url: r.page_url,
    status: r.status,
    created_at: r.created_at,
    user: r.user_id ? pMap.get(r.user_id) ?? null : null,
    workspace: r.workspace_id ? wMap.get(r.workspace_id) ?? null : null,
  }))

  return NextResponse.json(enriched)
}

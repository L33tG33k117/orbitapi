import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Super-admin view over the error_events table (migration 052). Raw stack
// traces, so this is deliberately never exposed to workspace admins.

export async function GET(req: Request) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filter = new URL(req.url).searchParams.get('filter') ?? 'open'
  const admin = createAdminClient()

  let q = admin
    .from('error_events')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(200)
  if (filter === 'open') q = q.eq('resolved', false)
  if (filter === 'resolved') q = q.eq('resolved', true)

  const { data, error } = await q
  if (error) {
    // Migration 052 not applied yet — report it as an empty list plus a flag so
    // the page can say "run the migration" instead of showing a broken table.
    return NextResponse.json({ events: [], unavailable: true, reason: error.message })
  }

  // Attach who hit it, in one round trip rather than a join per row.
  const events = data ?? []
  const userIds = [...new Set(events.map(e => e.user_id).filter(Boolean))] as string[]
  const wsIds = [...new Set(events.map(e => e.workspace_id).filter(Boolean))] as string[]

  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    userIds.length
      ? admin.from('profiles').select('id, email, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null }[] }),
    wsIds.length
      ? admin.from('workspaces').select('id, name').in('id', wsIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const byUser = new Map((profiles ?? []).map(p => [p.id, p]))
  const byWs = new Map((workspaces ?? []).map(w => [w.id, w]))

  return NextResponse.json({
    events: events.map(e => ({
      ...e,
      profile: e.user_id ? byUser.get(e.user_id) ?? null : null,
      workspace: e.workspace_id ? byWs.get(e.workspace_id) ?? null : null,
    })),
    unavailable: false,
  })
}

export async function PATCH(req: Request) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, resolved } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('error_events')
    .update({ resolved: Boolean(resolved) })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

async function authorize(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return { error: 'Forbidden', status: 403 as const }

  const admin = createAdminClient()
  const { data: playbook } = await admin.from('playbooks').select('*').eq('id', id).single()
  if (!playbook || playbook.workspace_id !== membership.workspace_id) {
    return { error: 'Not found', status: 404 as const }
  }
  return { user, membership, admin, playbook }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { data: runs } = await ctx.admin
    .from('playbook_runs')
    .select('id, status, mode, severity, autonomy_decision, summary, triggered_by, started_at, completed_at')
    .eq('playbook_id', id)
    .order('started_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ...ctx.playbook, runs: runs ?? [] })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of [
    'name', 'description', 'group_id', 'persona', 'definition',
    'autonomy_policy', 'trigger_type', 'schedule', 'enabled',
  ]) {
    if (key in body) patch[key] = body[key]
  }
  // group_id is a uuid column — an empty string from a "No group" <select>
  // must become null, not '' (which throws invalid-uuid).
  if ('group_id' in patch) patch.group_id = patch.group_id || null

  const { data, error } = await ctx.admin
    .from('playbooks').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { error } = await ctx.admin.from('playbooks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

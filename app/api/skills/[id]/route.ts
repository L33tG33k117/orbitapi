import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability } from '@/lib/entitlements'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data: skill } = await admin
    .from('skills')
    .select('*, group:groups(id, name, color, group_connections(connection_id))')
    .eq('id', id)
    .single()

  if (!skill || skill.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(skill)
}

export async function PUT(req: Request, { params }: Params) {
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
  const { data: existing } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!existing || existing.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()

  // Free (no skill_automation) is manual-only: ignore any schedule / non-manual
  // mode coming from a tampered client.
  const features = await getWorkspaceFeatures()
  const canAutomate = features ? hasCapability(features.tier, features.flags, 'skill_automation') : true
  const autonomy = canAutomate ? body.autonomy : 'manual'
  const schedule = canAutomate ? (body.schedule ?? null) : null

  const { error } = await admin.from('skills').update({
    name: body.name,
    description: body.description,
    group_id: body.group_id || null,
    persona: body.persona,
    blocked_slugs: body.blocked_slugs ?? [],
    autonomy,
    enabled: body.enabled,
    schedule,
    trigger_prompt: body.trigger_prompt ?? null,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Per-connection scope is persisted separately so a missing column (before
  // migration 046 is applied) can never break the core save.
  if (Array.isArray(body.connection_ids)) {
    const { error: scopeErr } = await admin
      .from('skills')
      .update({ connection_ids: body.connection_ids })
      .eq('id', id)
    if (scopeErr) console.warn('[skills PUT] connection_ids not persisted (migration 046 pending?):', scopeErr.message)
  }

  return new Response(null, { status: 204 })
}

export async function PATCH(req: Request, { params }: Params) {
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
  const { data: existing } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!existing || existing.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
  }

  const { error } = await admin.from('skills').update({ enabled: body.enabled }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

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
  const { data: existing } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!existing || existing.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await admin.from('skills').delete().eq('id', id)
  return new Response(null, { status: 204 })
}

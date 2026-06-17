import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const [
    { data: workspace, error: workspaceError },
    { data: members },
    { data: connections },
    { data: skills },
  ] = await Promise.all([
    admin.from('workspaces').select('id, name, tier, feature_flags, ai_credit_override, created_at').eq('id', id).single(),
    admin
      .from('memberships')
      .select('id, role, created_at, profile:profiles(id, email, full_name, super_admin)')
      .eq('workspace_id', id)
      .order('created_at'),
    admin
      .from('connections')
      .select('id, label, status, created_at, connector:connectors(name, slug)')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('skills')
      .select('id, name, autonomy, enabled, created_at')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Always return arrays so the client never crashes on a hiccuping sub-query.
  return NextResponse.json({
    workspace,
    members: members ?? [],
    connections: connections ?? [],
    skills: skills ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    tier?: string
    feature_flags?: Record<string, boolean>
    ai_credit_override?: number | null
  }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (body.tier) updates.tier = body.tier
  if (body.feature_flags) updates.feature_flags = body.feature_flags
  if (body.ai_credit_override !== undefined) {
    updates.ai_credit_override =
      body.ai_credit_override === null || Number.isNaN(body.ai_credit_override)
        ? null
        : Math.max(0, Math.floor(body.ai_credit_override))
  }

  const { data, error } = await admin
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select('id, name, tier, feature_flags, ai_credit_override')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

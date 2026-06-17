import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — create a snapshot of the current sandbox state
export async function POST(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, workspaceId } = await req.json() as {
    name?: string
    description?: string
    workspaceId?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: 'Snapshot name is required' }, { status: 400 })
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify ownership
  const { data: membership } = await admin
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (membership?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Gather sandbox state to snapshot — connections and skills (no credentials)
  const [{ data: connections }, { data: skills }, { data: groups }] = await Promise.all([
    admin
      .from('connections')
      .select('label, status, connector:connectors(slug, name)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
    admin
      .from('skills')
      .select('name, persona, enabled, trigger_type')
      .eq('workspace_id', workspaceId),
    admin
      .from('groups')
      .select('name, description')
      .eq('workspace_id', workspaceId),
  ])

  const snapshotData = {
    captured_at: new Date().toISOString(),
    connection_count: (connections ?? []).length,
    connections: (connections ?? []).map(c => ({
      label: c.label,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connector_slug: (c.connector as any)?.slug,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connector_name: (c.connector as any)?.name,
      status: c.status,
    })),
    skills: (skills ?? []).map(s => ({
      name: s.name,
      persona: s.persona,
      enabled: s.enabled,
      trigger_type: s.trigger_type,
    })),
    groups: (groups ?? []).map(g => ({ name: g.name, description: g.description })),
  }

  const { data: snapshot, error } = await admin
    .from('sandbox_snapshots')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() ?? null,
      snapshot_data: snapshotData,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshot })
}

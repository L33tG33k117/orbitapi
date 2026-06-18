import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capabilityGuard } from '@/lib/workspace-features'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('playbooks')
    .select('*, group:groups(id, name, color)')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at')

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const denied = await capabilityGuard('playbooks')
  if (denied) return denied

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('playbooks')
    .insert({
      workspace_id: membership.workspace_id,
      name: body.name.trim(),
      description: body.description ?? null,
      group_id: body.group_id || null,
      persona: body.persona ?? '',
      definition: body.definition ?? { steps: [] },
      autonomy_policy: body.autonomy_policy ?? undefined, // fall back to table default
      trigger_type: body.trigger_type ?? 'manual',
      schedule: body.schedule ?? null,
      source: body.source ?? 'custom',
      source_ref: body.source_ref ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

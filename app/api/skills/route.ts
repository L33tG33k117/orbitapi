import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capabilityGuard, getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability, skillLimit } from '@/lib/entitlements'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data: skills } = await admin
    .from('skills')
    .select('*, group:groups(id, name, color)')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at')

  return NextResponse.json(skills ?? [])
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

  const denied = await capabilityGuard('skills')
  if (denied) return denied

  const { name, description, group_id, persona, autonomy } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()

  // Plan limits: free gets a single skill (a taste) and manual-only (no
  // scheduling/autonomy). Paid tiers are unlimited and may automate.
  const features = await getWorkspaceFeatures()
  const tier = features?.tier ?? 'free'
  const canAutomate = features ? hasCapability(features.tier, features.flags, 'skill_automation') : true
  const limit = skillLimit(tier)
  if (Number.isFinite(limit)) {
    const { count } = await admin
      .from('skills')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', membership.workspace_id)
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: 'plan_required', message: `Your plan includes ${limit} skill. Upgrade for unlimited skills.`, requiredTier: 'starter' },
        { status: 403 },
      )
    }
  }

  const { data, error } = await admin
    .from('skills')
    .insert({
      workspace_id: membership.workspace_id,
      name: name.trim(),
      description,
      group_id: group_id || null,
      persona: persona ?? '',
      autonomy: !canAutomate ? 'manual' : (autonomy ?? 'supervised'),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

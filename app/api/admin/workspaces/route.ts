import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { planBaseCredits } from '@/lib/ai-power'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: workspaces, error } = await admin
    .from('workspaces')
    .select('id, name, tier, feature_flags, ai_credit_override, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Augment with owner email and counts
  const enriched = await Promise.all((workspaces ?? []).map(async ws => {
    const [
      { data: ownerMembership },
      { count: memberCount },
      { count: connectionCount },
      { count: skillCount },
    ] = await Promise.all([
      admin
        .from('memberships')
        .select('user_id, profile:profiles(email, full_name)', { count: 'exact' })
        .eq('workspace_id', ws.id)
        .eq('role', 'owner')
        .single(),
      admin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ws.id),
      admin
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .eq('status', 'active'),
      admin
        .from('skills')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .eq('enabled', true),
    ])

    const owner = (ownerMembership as unknown as { profile: { email: string; full_name: string | null } } | null)?.profile
    const override = (ws as { ai_credit_override?: number | null }).ai_credit_override
    const hasOverride = typeof override === 'number' && override >= 0
    return {
      ...ws,
      owner_email: owner?.email ?? null,
      owner_name: owner?.full_name ?? null,
      member_count: memberCount ?? 0,
      connection_count: connectionCount ?? 0,
      skill_count: skillCount ?? 0,
      monthly_credits: hasOverride ? override : planBaseCredits(ws.tier),
      credits_overridden: hasOverride,
    }
  }))

  return NextResponse.json(enriched)
}

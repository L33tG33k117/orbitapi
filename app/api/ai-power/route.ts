import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAiPower } from '@/lib/ai-power'

const VALID = ['maximum', 'balanced', 'economy']

// Current AI Power for the caller's workspace — used by the live meter in the
// Orbit Assistant so it can refresh after each message. Only user-facing fields.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const power = await getAiPower(membership.workspace_id)
  return NextResponse.json({
    remaining: power.remaining,
    allowance: power.allowance,
    used: power.used,
    pctUsed: power.pctUsed,
    resetInDays: power.resetInDays,
    isTrial: power.isTrial,
    tier: power.tier,
  })
}

// Set the workspace default Efficiency and per-skill overrides. No model/vendor
// names cross this boundary — only efficiency levels.
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  if (body.defaultEfficiency && VALID.includes(body.defaultEfficiency)) {
    await admin.from('workspaces').update({ ai_efficiency: body.defaultEfficiency }).eq('id', membership.workspace_id)
  }

  if (body.skill?.id) {
    const eff = body.skill.efficiency
    await admin.from('skills')
      .update({ ai_efficiency: eff && VALID.includes(eff) ? eff : null })
      .eq('id', body.skill.id)
      .eq('workspace_id', membership.workspace_id)
  }

  return NextResponse.json({ ok: true })
}

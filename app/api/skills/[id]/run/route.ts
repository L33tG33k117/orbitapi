import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSkill } from '@/lib/skill-runner'
import { OUT_OF_AI_POWER } from '@/lib/ai-power'
import { parseUnreadyConnections } from '@/lib/connection-readiness'
import { capabilityGuard } from '@/lib/workspace-features'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
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

  if (!(await rateLimit(`skill-run:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: skill } = await admin.from('skills').select('workspace_id, persona').eq('id', id).single()
  if (!skill || skill.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Don't run a skill with no instructions — it would just improvise.
  if (!skill.persona || !skill.persona.trim()) {
    return NextResponse.json({ error: 'This skill has no persona yet. Add instructions and verify it before running.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const mode: 'dry_run' | 'live' = body.mode === 'live' ? 'live' : 'dry_run'
  const prompt: string | undefined = body.prompt

  try {
    const runId = await runSkill({
      skillId: id,
      workspaceId: membership.workspace_id,
      mode,
      prompt,
      triggeredBy: 'manual',
    })
    return NextResponse.json({ run_id: runId })
  } catch (err) {
    if (String(err).includes(OUT_OF_AI_POWER)) {
      return NextResponse.json({ error: 'out_of_ai_power', message: "You're out of AI Power for this cycle. Upgrade your plan or add a Power Pack." }, { status: 402 })
    }
    const unready = parseUnreadyConnections(err)
    if (unready) {
      return NextResponse.json({
        error: 'connections_not_set_up',
        message: 'Some apps this skill uses were never set up. Finish their setup, or switch them to Simulation to test with sample data.',
        connections: unready,
      }, { status: 409 })
    }
    console.error('[skill run]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

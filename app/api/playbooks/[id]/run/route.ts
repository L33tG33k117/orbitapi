import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPlaybook } from '@/lib/playbook-runner'
import { OUT_OF_AI_POWER } from '@/lib/ai-power'
import { capabilityGuard } from '@/lib/workspace-features'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 300

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

  const denied = await capabilityGuard('playbooks')
  if (denied) return denied

  if (!(await rateLimit(`playbook-run:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: playbook } = await admin.from('playbooks').select('workspace_id').eq('id', id).single()
  if (!playbook || playbook.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const mode: 'dry_run' | 'live' = body.mode === 'dry_run' ? 'dry_run' : 'live'

  try {
    const { runId, status } = await runPlaybook({
      playbookId: id,
      workspaceId: membership.workspace_id,
      mode,
      prompt: body.prompt,
      triggeredBy: 'manual',
    })
    return NextResponse.json({ run_id: runId, status })
  } catch (err) {
    if (String(err).includes(OUT_OF_AI_POWER)) {
      return NextResponse.json({ error: 'out_of_ai_power', message: "You're out of AI Power for this cycle. Upgrade your plan or add a Power Pack." }, { status: 402 })
    }
    console.error('[playbook run]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

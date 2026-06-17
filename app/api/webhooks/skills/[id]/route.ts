import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSkill } from '@/lib/skill-runner'

// Webhook receiver for autonomous skill triggers.
// External services (Lodgify, Ring, etc.) POST here with the skill's webhook secret.
// URL: POST /api/webhooks/skills/[id]?secret=[webhook_secret]
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')

  if (!secret) {
    return NextResponse.json({ error: 'Missing secret' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: skill } = await admin
    .from('skills')
    .select('id, workspace_id, webhook_secret, autonomy, enabled, name')
    .eq('id', id)
    .single()

  if (!skill) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!skill.webhook_secret || skill.webhook_secret !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }
  if (!skill.enabled) {
    return NextResponse.json({ error: 'Skill is disabled' }, { status: 409 })
  }

  // Parse optional payload — passed as context to the skill run
  let payload: Record<string, unknown> = {}
  try {
    const body = await req.text()
    if (body) payload = JSON.parse(body)
  } catch {
    // Non-JSON body is fine — ignore it
  }

  // Build a prompt that surfaces the webhook payload to the AI
  const triggerPrompt = Object.keys(payload).length > 0
    ? `You were triggered by an external webhook. Payload: ${JSON.stringify(payload, null, 2)}\n\nReact to this event and carry out your responsibilities accordingly.`
    : 'You were triggered by an external webhook event. Carry out your responsibilities now.'

  // Supervised skills dry-run even on webhook; autonomous/manual run live
  const mode = skill.autonomy === 'supervised' ? 'dry_run' : 'live'

  try {
    const runId = await runSkill({
      skillId: skill.id,
      workspaceId: skill.workspace_id,
      mode,
      prompt: triggerPrompt,
      triggeredBy: 'webhook',
    })
    return NextResponse.json({ run_id: runId, mode, skill: skill.name })
  } catch (err) {
    console.error('[webhook] skill run failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

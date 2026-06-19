import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { screenInput } from '@/lib/prompt-safety'

export type CheckStatus = 'pass' | 'warn' | 'fail'
interface Check { status: CheckStatus; label: string; detail?: string }

// Verify a skill before it can be saved: confirm the connectors it needs are
// actually connected and that its logic is coherent. Operates on the LIVE form
// (sent in the body), not the saved skill, so it validates unsaved edits.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  // Ownership check (the skill must belong to this workspace).
  const { data: existing } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!existing || existing.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const persona: string = (body.persona ?? '').toString()
  const triggerPrompt: string = (body.trigger_prompt ?? '').toString()
  const groupId: string | null = body.group_id || null
  const blockedSlugs: string[] = Array.isArray(body.blocked_slugs) ? body.blocked_slugs : []

  // Resolve the connections this skill can use: a group's connections, or all
  // active workspace connections when no group is selected.
  let connectionIds: string[] | null = null
  if (groupId) {
    const { data: group } = await admin
      .from('groups')
      .select('group_connections(connection_id)')
      .eq('id', groupId)
      .eq('workspace_id', membership.workspace_id)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connectionIds = ((group as any)?.group_connections ?? []).map((gc: { connection_id: string }) => gc.connection_id)
  }

  let connQuery = admin
    .from('connections')
    .select('id, label, connector:connectors(slug, name)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')
  if (connectionIds) connQuery = connQuery.in('id', connectionIds.length ? connectionIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: conns } = await connQuery

  const connectors = (conns ?? []).map(c => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slug = (c.connector as any)?.slug
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (c.connector as any)?.name ?? slug
    const manifest = getConnector(slug)
    const actions = (manifest?.actions ?? []).filter(a => !blockedSlugs.includes(a.slug))
    return {
      slug, name, label: c.label,
      reads: actions.filter(a => a.risk === 'read').length,
      writes: actions.filter(a => a.risk !== 'read').length,
      actions: actions.map(a => ({ slug: a.slug, name: a.name, risk: a.risk, description: a.description })),
    }
  })

  const checks: Check[] = []

  // ── Deterministic checks ──────────────────────────────────────────────────
  if (!persona.trim()) {
    checks.push({ status: 'fail', label: 'Persona is empty', detail: 'Describe what this skill should do before saving.' })
  }
  if (connectors.length === 0) {
    checks.push({
      status: 'fail',
      label: 'No connectors available',
      detail: groupId
        ? 'The selected group has no active connections. Add connectors to it, or choose a different group.'
        : 'This workspace has no active connections. Connect (or simulate) an app first.',
    })
  }

  // Safety screen — block obvious injection/exfiltration attempts in the persona.
  const safety = screenInput(`${persona}\n${triggerPrompt}`)
  if (safety.level === 'block') {
    checks.push({ status: 'fail', label: 'Disallowed content in persona', detail: `Looks like an attempt to access internal/other-account data or inject code: ${safety.reasons.join('; ')}. Remove it before saving.` })
  } else if (safety.level === 'warn') {
    checks.push({ status: 'warn', label: 'Suspicious phrasing in persona', detail: safety.reasons.join('; ') })
  }

  // ── AI analysis: does the persona's plan match the available actions? ──────
  if (persona.trim() && connectors.length > 0) {
    const actionsText = connectors.map(c =>
      `${c.name} ("${c.label}"):\n${c.actions.map(a => `  - ${a.slug} [${a.risk}]: ${a.name}`).join('\n') || '  (no actions)'}`
    ).join('\n\n')

    try {
      const { text } = await generateText({
        model: anthropic('claude-sonnet-4-6'),
        system: `You verify whether an automation "skill" can actually run with the connectors available to it. You are given the skill's persona (its instructions) and the EXACT list of connected apps + actions it can use. Decide if the skill is buildable.

Return ONLY a JSON object, no markdown:
{
  "checks": [ { "status": "pass" | "warn" | "fail", "label": "<short>", "detail": "<one sentence>" } ],
  "summary": "<one sentence overall>"
}

Rules:
- If the persona needs an app or action that is NOT in the available list (e.g. it says "post to Slack" but no Slack connection exists, or "trigger a PagerDuty incident" with no PagerDuty), add a "fail" check naming the missing app/action.
- If every capability the persona relies on is present in the list, add a "pass" check confirming it.
- Flag genuinely unclear, contradictory, or impossible logic as "warn" (do not nitpick wording).
- 2 to 5 checks total. Be concrete and reference the actual app names.`,
        prompt: `PERSONA:\n${persona}\n\n${triggerPrompt ? `TRIGGER CONDITION:\n${triggerPrompt}\n\n` : ''}AVAILABLE CONNECTED APPS & ACTIONS:\n${actionsText}\n\nReturn the JSON verdict.`,
        maxOutputTokens: 900,
      })
      const cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
      const parsed = JSON.parse(cleaned) as { checks?: Check[] }
      for (const c of parsed.checks ?? []) {
        if (c && (c.status === 'pass' || c.status === 'warn' || c.status === 'fail') && c.label) {
          checks.push({ status: c.status, label: c.label, detail: c.detail })
        }
      }
    } catch {
      checks.push({ status: 'warn', label: 'Could not fully analyze logic', detail: 'Automated logic check was unavailable — review the persona manually.' })
    }
  }

  const verdict: 'pass' | 'fail' = checks.some(c => c.status === 'fail') ? 'fail' : 'pass'
  const summary = verdict === 'pass'
    ? 'Looks good — connectors are available and the logic checks out.'
    : 'This skill can\'t be saved yet — resolve the issues below.'

  return NextResponse.json({
    verdict,
    summary,
    checks,
    connectors: connectors.map(c => ({ slug: c.slug, name: c.name, label: c.label, reads: c.reads, writes: c.writes })),
  })
}

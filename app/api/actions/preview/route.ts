import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { CHEAP_MODEL } from '@/lib/usage-cost'
import { AI_MAX_RETRIES, NO_THINKING } from '@/lib/ai-resilience'

// Feature #9 — Destructive action preview.
// Predicts the impact of an action BEFORE it runs, and whether it's reversible,
// so a human can make an informed approve/reject decision. Read-only: never
// executes the action, never writes to the audit log.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, actionSlug, params } = await req.json()
  if (!connectionId || !actionSlug) {
    return NextResponse.json({ error: 'connectionId and actionSlug required' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('connections')
    .select('label, connector:connectors(slug, name)')
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id)
    .single()
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (conn.connector as any)?.slug
  const manifest = getConnector(slug)
  const action = manifest?.actions.find(a => a.slug === actionSlug)
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })

  // Read actions are always safe/reversible — skip the LLM call.
  if (action.risk === 'read') {
    return NextResponse.json({
      risk: 'read', reversible: true,
      impact: 'Read-only — fetches data without changing anything.',
    })
  }

  const reversible = action.risk !== 'destructive'

  // Ask a cheap model to predict the concrete impact from the action contract.
  let impact = action.risk === 'destructive'
    ? 'This is a destructive action and may not be undoable.'
    : 'This writes data to the connected system.'
  try {
    const { text } = await generateText({
      model: anthropic(CHEAP_MODEL),
      maxRetries: AI_MAX_RETRIES,
      providerOptions: NO_THINKING,
      system: `You predict the real-world impact of an API action before it runs, for a human approver.
Be concrete and concise (one or two sentences). State what will change and roughly how much, based on the
action and its parameters. If it is destructive, say plainly that it cannot be undone. Do not hedge with
"might" if the action clearly does the thing. Output ONLY the impact sentence(s).`,
      prompt: `Connector: ${conn.connector && (conn.connector as { name?: string }).name} (${slug})
Connection: ${conn.label}
Action: ${action.name} — ${action.description}
Risk class: ${action.risk}
Parameters: ${JSON.stringify(params ?? {}).slice(0, 1000)}`,
      maxOutputTokens: 150,
    })
    if (text.trim()) impact = text.trim()
  } catch {
    // fall back to the static impact text
  }

  return NextResponse.json({
    risk: action.risk,
    reversible,
    impact,
    action: { name: action.name, slug: action.slug },
    connection: { label: conn.label },
  })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // #9 — optional rollback reasoning captured at approval time for destructive actions.
  const body = await req.json().catch(() => ({}))
  const rollbackReasoning: string | undefined = body?.rollback_reasoning

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  if (membership.role === 'member') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: pending } = await admin
    .from('pending_actions')
    .select('*, connection:connections(*, connector:connectors(slug))')
    .eq('id', id)
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'pending')
    .single()

  if (!pending) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })

  if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
    await admin.from('pending_actions').update({ status: 'expired' }).eq('id', id)
    return NextResponse.json({ error: 'Action has expired' }, { status: 410 })
  }

  const connection = pending.connection as {
    id: string; workspace_id: string; vault_secret_id: string | null
    connector: { slug: string }
  }
  const manifest = getConnector(connection.connector.slug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const action = manifest.actions.find(a => a.slug === pending.action_slug)
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })

  const creds = await resolveCredentials(connection)

  await admin.from('pending_actions').update({ status: 'confirmed' }).eq('id', id)

  const result = await action.execute(creds, (pending.params as Record<string, unknown>) ?? {})
  const finalStatus = result.ok ? 'executed' : 'failed'

  await admin.from('pending_actions').update({ status: finalStatus }).eq('id', id)
  const baseSummary = result.ok
    ? JSON.stringify(result.data).slice(0, 500)
    : (result.error ?? 'Unknown error')
  await admin.from('audit_log').insert({
    workspace_id: membership.workspace_id,
    actor_type: 'user',
    actor_id: user.id,
    connection_id: connection.id,
    action_slug: pending.action_slug,
    risk: action.risk,
    params: pending.params,
    response: result.ok ? (result.data ?? null) : null,
    result_status: result.ok ? 'success' : 'error',
    result_summary: rollbackReasoning
      ? `[Rollback plan: ${rollbackReasoning.slice(0, 200)}] ${baseSummary}`.slice(0, 500)
      : baseSummary,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, data: result.data })
}

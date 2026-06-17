import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { resumePlaybookRun } from '@/lib/playbook-runner'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch pending action — must belong to this user and still be pending
  const { data: pending } = await admin
    .from('pending_actions')
    .select('*, connection:connections(*, connector:connectors(slug))')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!pending) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })

  // Check expiry
  if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
    await admin.from('pending_actions').update({ status: 'expired' }).eq('id', id)
    return NextResponse.json({ error: 'Action has expired' }, { status: 410 })
  }

  // Playbook approval gate: don't execute here — resume the parked run, which
  // re-runs the approved node itself (single, engine-audited execution path).
  const pbParams = (pending.params ?? {}) as Record<string, unknown>
  const playbookRunId = pbParams.__playbook_run as string | undefined
  if (playbookRunId) {
    await admin.from('pending_actions').update({ status: 'confirmed' }).eq('id', id)
    const { status } = await resumePlaybookRun({ runId: playbookRunId, approved: true })
    return NextResponse.json({ data: { resumed: true, runStatus: status } })
  }

  const connection = pending.connection as {
    id: string; workspace_id: string; vault_secret_id: string | null;
    connector: { slug: string }
  }
  const manifest = getConnector(connection.connector.slug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const action = manifest.actions.find(a => a.slug === pending.action_slug)
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })

  const creds = await resolveCredentials(connection)

  // Mark as confirmed before executing (idempotency guard)
  await admin.from('pending_actions').update({ status: 'confirmed' }).eq('id', id)

  const result = await action.execute(creds, (pending.params as Record<string, unknown>) ?? {})

  const finalStatus = result.ok ? 'executed' : 'failed'
  await admin.from('pending_actions').update({ status: finalStatus }).eq('id', id)

  await admin.from('audit_log').insert({
    workspace_id: connection.workspace_id,
    actor_type: 'user',
    actor_id: user.id,
    connection_id: connection.id,
    action_slug: pending.action_slug,
    risk: action.risk,
    params: pending.params,
    result_status: result.ok ? 'success' : 'error',
    result_summary: result.ok
      ? JSON.stringify(result.data).slice(0, 500)
      : (result.error ?? 'Unknown error'),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: result.data })
}

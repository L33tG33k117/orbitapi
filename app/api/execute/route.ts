import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { resolveSimulatedAction } from '@/lib/sim-engine'
import { riskAllowed, explorationBlocks } from '@/lib/connector-access'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, actionSlug, params, replayOf } = await req.json()
  if (!connectionId || !actionSlug) {
    return NextResponse.json({ error: 'connectionId and actionSlug are required' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch connection
  const { data: conn } = await admin
    .from('connections')
    .select('*, connector:connectors(slug, name)')
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')
    .single()

  if (!conn) return NextResponse.json({ error: 'Connection not found or inactive' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connSlug = (conn.connector as any)?.slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connName = (conn.connector as any)?.name ?? connSlug
  const manifest = getConnector(connSlug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const action = manifest.actions.find(a => a.slug === actionSlug)
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })

  // Per-connector access controls: this connection may have a class disabled.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!riskAllowed((conn as any).allowed_risk_levels, action.risk)) {
    return NextResponse.json({ error: `${action.risk} actions are disabled for this connection.` }, { status: 403 })
  }

  // Open API exploration can be turned off per connection (conn selected with '*',
  // so the flag is present once migration 048 is applied; absent ⇒ allowed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (explorationBlocks(conn as any, actionSlug)) {
    return NextResponse.json({ error: 'Open API exploration is turned off for this connection.' }, { status: 403 })
  }

  // Members: check grants
  if (membership.role === 'member') {
    const { data: grant } = await admin
      .from('connection_grants')
      .select('level')
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)
      .single()
    if (!grant) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    if (action.risk !== 'read' && grant.level !== 'read_write') {
      return NextResponse.json({ error: 'Read-only access — cannot perform write actions' }, { status: 403 })
    }
  }

  const started = Date.now()
  const result = conn.is_simulated
    ? await resolveSimulatedAction({
        workspaceId: membership.workspace_id,
        connectionId,
        connectorSlug: connSlug,
        connectorName: connName,
        action,
        params: params ?? {},
      })
    : await action.execute(await resolveCredentials(conn), params ?? {})

  // Audit log (Foundation B: capture full response + latency; link replays)
  const durationMs = Date.now() - started
  await admin.from('audit_log').insert({
    workspace_id: membership.workspace_id,
    actor_type: 'user',
    actor_id: user.id,
    connection_id: connectionId,
    action_slug: actionSlug,
    risk: action.risk,
    params: params ?? {},
    response: result.ok ? (result.data ?? null) : { error: result.error },
    duration_ms: durationMs,
    replay_of: replayOf ?? null,
    result_status: result.ok ? 'success' : 'error',
    result_summary: result.ok
      ? JSON.stringify(result.data).slice(0, 500)
      : (result.error ?? 'Unknown error'),
  })

  return NextResponse.json({
    ok: result.ok,
    data: result.ok ? result.data : undefined,
    error: result.ok ? undefined : result.error,
    durationMs,
    action: { slug: actionSlug, name: action.name, risk: action.risk },
    connector: { slug: connSlug, name: (conn.connector as any)?.name },
    connection: { id: connectionId, label: conn.label },
  })
}

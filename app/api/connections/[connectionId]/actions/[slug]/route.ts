import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'

type Params = { params: Promise<{ connectionId: string; slug: string }> }

export async function POST(request: Request, { params }: Params) {
  const { connectionId, slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('connections')
    .select('*, connector:connectors(slug)')
    .eq('id', connectionId)
    .single()

  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify caller belongs to this workspace
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const connectorSlug = (connection.connector as { slug: string }).slug
  const manifest = getConnector(connectorSlug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const action = manifest.actions.find(a => a.slug === slug)
  if (!action) return NextResponse.json({ error: `Unknown action: ${slug}` }, { status: 404 })

  // Members can only run read actions
  if (action.risk !== 'read' && membership.role === 'member') {
    return NextResponse.json({ error: 'Members can only run read actions' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const creds = await resolveCredentials(connection)
  const result = await action.execute(creds, body)

  // Write audit log entry
  await admin.from('audit_log').insert({
    workspace_id: connection.workspace_id,
    actor_type: 'user',
    actor_id: user.id,
    connection_id: connectionId,
    action_slug: slug,
    risk: action.risk,
    params: body,
    result_status: result.ok ? 'success' : 'error',
    result_summary: result.ok ? 'Action executed successfully' : result.error,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ data: result.data })
}

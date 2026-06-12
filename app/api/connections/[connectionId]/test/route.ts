import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'

type Params = { params: Promise<{ connectionId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { connectionId } = await params
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
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const manifest = getConnector((connection.connector as { slug: string }).slug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const creds = await resolveCredentials(connection)
  const result = await manifest.testConnection(creds)

  if (result.ok) {
    await admin.from('connections').update({ status: 'active' }).eq('id', connectionId)
  } else {
    await admin.from('connections').update({ status: 'error' }).eq('id', connectionId)
  }

  return NextResponse.json(result)
}

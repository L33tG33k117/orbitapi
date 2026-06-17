import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { z } from 'zod'

type Params = { params: Promise<{ connectionId: string }> }

const schema = z.object({
  credentials: z.record(z.string(), z.string()),
  label: z.string().min(1).max(80).optional(),
})

export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()

  // Load connection and verify ownership
  const { data: connection } = await admin
    .from('connections')
    .select('*, connector:connectors(slug)')
    .eq('id', connectionId)
    .single()

  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!connection.is_simulated) return NextResponse.json({ error: 'Connection is already real' }, { status: 400 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('workspace_id', connection.workspace_id)
    .single()

  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const connectorSlug = (connection.connector as { slug: string }).slug
  const manifest = getConnector(connectorSlug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const { credentials, label } = parsed.data

  // Store real credentials in Vault
  const secretName = `connection_${user.id}_${connectorSlug}_${Date.now()}`
  const { data: vaultData, error: vaultErr } = await admin.rpc('vault.create_secret', {
    secret: JSON.stringify(credentials),
    name: secretName,
  })

  const vaultSecretId: string | null = vaultErr ? null : (vaultData as string)

  const inlineSecret = vaultErr
    ? `inline:${Buffer.from(JSON.stringify(credentials)).toString('base64')}`
    : null

  // Flip is_simulated = false and store real credentials
  const { data: updated, error: updateErr } = await admin
    .from('connections')
    .update({
      is_simulated: false,
      vault_secret_id: vaultSecretId ?? inlineSecret,
      ...(label ? { label } : {}),
      status: 'active',
    })
    .eq('id', connectionId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Run connection test
  const creds = { ...credentials, connection_id: connectionId }
  let testResult: { ok: boolean; label?: string; error?: string } = { ok: true }
  try {
    testResult = await manifest.testConnection(creds)
  } catch (e) {
    testResult = { ok: false, error: String(e) }
  }

  return NextResponse.json({ connection: updated, test: testResult })
}

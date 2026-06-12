import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { z } from 'zod'

const schema = z.object({
  connectorSlug: z.string(),
  label: z.string().min(1).max(80),
  credentials: z.record(z.string(), z.string()),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { connectorSlug, label, credentials } = parsed.data

  const manifest = getConnector(connectorSlug)
  if (!manifest) return NextResponse.json({ error: 'Unknown connector' }, { status: 404 })

  // Get caller's workspace
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden — only admins/owners can add connections' }, { status: 403 })
  }

  // Get the connector row id
  const admin = createAdminClient()
  const { data: connectorRow } = await admin
    .from('connectors')
    .select('id')
    .eq('slug', connectorSlug)
    .single()

  if (!connectorRow) return NextResponse.json({ error: 'Connector not found in database' }, { status: 404 })

  // Store credentials in Vault
  const secretName = `connection_${user.id}_${connectorSlug}_${Date.now()}`
  const { data: vaultData, error: vaultErr } = await admin.rpc('vault.create_secret', {
    secret: JSON.stringify(credentials),
    name: secretName,
  })

  // Vault might not be enabled — fall back to encrypted column storage note
  // In production, ensure Supabase Vault is enabled on the project
  const vaultSecretId: string | null = vaultErr ? null : (vaultData as string)

  if (vaultErr) {
    console.warn('Vault not available, connection stored without encrypted credentials:', vaultErr.message)
  }

  const { data: connection, error: connErr } = await admin
    .from('connections')
    .insert({
      workspace_id: membership.workspace_id,
      connector_id: connectorRow.id,
      label,
      vault_secret_id: vaultSecretId,
      status: 'active',
      created_by: user.id,
    })
    .select()
    .single()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })

  // If vault unavailable, store creds temporarily in a separate mechanism
  // For now, store in a metadata field as a stopgap (replace with Vault in prod)
  if (vaultErr && credentials) {
    await admin
      .from('connections')
      .update({ vault_secret_id: `inline:${Buffer.from(JSON.stringify(credentials)).toString('base64')}` })
      .eq('id', connection.id)
  }

  // For simulated lights: create an initial device
  if (connectorSlug === 'simulated-lights') {
    await admin.from('simulated_devices').insert({
      connection_id: connection.id,
      device_name: 'Living Room',
      is_on: false,
      brightness: 100,
      hex_color: '#FFFFFF',
      color_temp: 3000,
    }).select()
  }

  return NextResponse.json({ connection }, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ connections: [] })

  const { data: connections } = await supabase
    .from('connections')
    .select('*, connector:connectors(slug, name, category, is_simulated)')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at')

  return NextResponse.json({ connections: connections ?? [] })
}

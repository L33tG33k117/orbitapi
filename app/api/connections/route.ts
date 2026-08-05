import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storeSecret } from '@/lib/credentials'
import { getConnector } from '@/connectors'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { connectorLimit } from '@/lib/entitlements'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  connectorSlug: z.string(),
  label: z.string().min(1).max(80),
  credentials: z.record(z.string(), z.string()),
  isSimulated: z.boolean().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { connectorSlug, label, credentials, isSimulated = false } = parsed.data

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

  // Plan limit: cap REAL (non-simulated) connectors per tier. Simulated/demo
  // connections are always allowed and never count toward the limit.
  if (!isSimulated) {
    const features = await getWorkspaceFeatures()
    const limit = connectorLimit(features?.tier ?? 'free')
    if (Number.isFinite(limit)) {
      const { count } = await admin
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', membership.workspace_id)
        .eq('is_simulated', false)
        .neq('status', 'trashed')
      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: 'plan_required', message: `Your plan includes ${limit} connectors. Upgrade to connect more.`, requiredTier: 'starter' },
          { status: 403 },
        )
      }
    }
  }
  let { data: connectorRow } = await admin
    .from('connectors')
    .select('id')
    .eq('slug', connectorSlug)
    .single()

  // Self-heal: connectors added in code (catalog waves, factory specs) may not
  // have a DB row yet — seed it from the manifest instead of failing. This was
  // "connector not found" when simulating Microsoft Outlook (beta feedback).
  if (!connectorRow) {
    const { data: seeded } = await admin
      .from('connectors')
      .upsert({
        slug: manifest.slug,
        name: manifest.name,
        category: manifest.category,
        manifest: { description: manifest.description },
        is_simulated: !!manifest.isSimulated,
      }, { onConflict: 'slug' })
      .select('id')
      .single()
    connectorRow = seeded
  }

  if (!connectorRow) return NextResponse.json({ error: 'Connector not found in database' }, { status: 404 })

  // Simulated connections have no real credentials to protect — the marker is
  // a flag, not a secret, so it stays plain.
  let vaultSecretId: string | null = null
  if (isSimulated) {
    vaultSecretId = `inline:${Buffer.from(JSON.stringify({ __simulated: true })).toString('base64')}`
  } else {
    vaultSecretId = await storeSecret(credentials, `connection_${user.id}_${connectorSlug}_${Date.now()}`)
  }

  const { data: connection, error: connErr } = await admin
    .from('connections')
    .insert({
      workspace_id: membership.workspace_id,
      connector_id: connectorRow.id,
      label,
      vault_secret_id: vaultSecretId,
      is_simulated: isSimulated,
      status: 'active',
      created_by: user.id,
    })
    .select()
    .single()

  if (connErr) {
    // Logged as well as returned: connErr.message is sometimes empty (a bare
    // permission or constraint failure), and a 500 with an empty body is
    // impossible to act on — especially on a self-hosted box where nobody can
    // read our server logs for the customer.
    // JSON.stringify on an Error yields "{}" — message and stack are
    // non-enumerable — so serialise every own property explicitly.
    console.error('[connections] insert failed:', JSON.stringify(
      Object.fromEntries(Object.getOwnPropertyNames(connErr).map(k => [k, (connErr as unknown as Record<string, unknown>)[k]])),
    ))
    return NextResponse.json(
      { error: connErr.message || connErr.hint || connErr.details || connErr.code || 'Could not save the connection.' },
      { status: 500 },
    )
  }

  await logAuditEvent({ workspaceId: membership.workspace_id, userId: user.id, actorEmail: user.email,
    category: 'connector', action: 'connector.connected', target: label,
    summary: `Connected ${manifest.name}${isSimulated ? ' (simulated)' : ''} as “${label}”`, metadata: { connectorSlug, isSimulated } })

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

  // For simulated Ring: create a default doorbell device
  if (connectorSlug === 'simulated-ring') {
    await admin.from('simulated_ring_devices').insert({
      connection_id: connection.id,
      device_name: 'Front Door',
      device_type: 'doorbell',
      location: 'Entrance',
    })
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

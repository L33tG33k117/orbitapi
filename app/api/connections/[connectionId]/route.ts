import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { normalizeRiskLevels } from '@/lib/connector-access'
import { logAuditEvent } from '@/lib/audit'

type Params = { params: Promise<{ connectionId: string }> }

// PATCH — update label and/or credentials
export async function PATCH(req: Request, { params }: Params) {
  const { connectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('connections')
    .select('id, label, workspace_id, vault_secret_id, connector:connectors(slug)')
    .eq('id', connectionId)
    .single()

  if (!connection || connection.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { label, credentials, testFirst, allowedRiskLevels, allowApiExploration } = body as {
    label?: string
    credentials?: Record<string, string>
    testFirst?: boolean
    allowedRiskLevels?: string[]
    allowApiExploration?: boolean
  }

  const updates: Record<string, unknown> = {}
  if (label) updates.label = label
  if (allowedRiskLevels !== undefined) updates.allowed_risk_levels = normalizeRiskLevels(allowedRiskLevels)
  if (allowApiExploration !== undefined) updates.allow_api_exploration = !!allowApiExploration

  // If new credentials provided, store them
  if (credentials && Object.keys(credentials).length > 0) {
    // Optionally test before saving
    if (testFirst) {
      const slug = (connection.connector as unknown as { slug: string }).slug
      const manifest = getConnector(slug)
      if (manifest) {
        const test = await manifest.testConnection({ ...credentials, connection_id: connectionId })
        if (!test.ok) {
          return NextResponse.json({ error: `Connection test failed: ${test.error}` }, { status: 422 })
        }
      }
    }

    // Try vault first, fall back to inline
    const secretName = `connection_${connectionId}_${Date.now()}`
    const { data: vaultData, error: vaultErr } = await admin.rpc('vault.create_secret', {
      secret: JSON.stringify(credentials),
      name: secretName,
    })

    if (vaultErr) {
      updates.vault_secret_id = `inline:${Buffer.from(JSON.stringify(credentials)).toString('base64')}`
    } else {
      updates.vault_secret_id = vaultData as string
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await admin.from('connections').update(updates).eq('id', connectionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Governance trail — record config changes to this connection.
  const connLabel = (connection as { label?: string }).label ?? 'a connection'
  const ctx = { workspaceId: membership.workspace_id, userId: user.id, actorEmail: user.email, target: connLabel }
  if (allowedRiskLevels !== undefined) {
    await logAuditEvent({ ...ctx, category: 'access', action: 'connector.access_changed',
      summary: `Changed allowed action types on “${connLabel}” to ${(updates.allowed_risk_levels as string[]).join(', ')}`,
      metadata: { allowed_risk_levels: updates.allowed_risk_levels } })
  }
  if (allowApiExploration !== undefined) {
    await logAuditEvent({ ...ctx, category: 'access', action: 'connector.exploration_toggled',
      summary: `Turned open API exploration ${allowApiExploration ? 'on' : 'off'} for “${connLabel}”` })
  }
  if (credentials && Object.keys(credentials).length > 0) {
    await logAuditEvent({ ...ctx, category: 'connector', action: 'connector.credentials_updated',
      summary: `Updated credentials for “${connLabel}”` })
  }
  if (label && label !== connLabel) {
    await logAuditEvent({ ...ctx, category: 'connector', action: 'connector.renamed',
      summary: `Renamed “${connLabel}” to “${label}”`, metadata: { from: connLabel, to: label } })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: Params) {
  const { connectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // mode: 'trash' (default) | 'permanent'
  const url = new URL(req.url)
  let mode = url.searchParams.get('mode') ?? 'trash'

  const admin = createAdminClient()

  // Workspace deletion policy: when locked, the workspace default wins and the
  // requested mode is ignored (admins can enforce trash-only, etc.).
  const { data: ws } = await admin
    .from('workspaces')
    .select('connection_delete_default, connection_delete_locked')
    .eq('id', membership.workspace_id)
    .single()
  if (ws?.connection_delete_locked && ws.connection_delete_default) {
    mode = ws.connection_delete_default
  }

  // Verify the connection belongs to this workspace
  const { data: connection } = await admin
    .from('connections')
    .select('id, label, workspace_id')
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id)
    .single()

  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const connLabel = (connection as { label?: string }).label ?? 'a connection'
  const auditCtx = { workspaceId: membership.workspace_id, userId: user.id, actorEmail: user.email, category: 'connector' as const, target: connLabel }

  if (mode === 'permanent') {
    // Hard delete — wipes connection and all related data via FK cascade
    const { error } = await admin
      .from('connections')
      .delete()
      .eq('id', connectionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditEvent({ ...auditCtx, action: 'connector.deleted', summary: `Permanently deleted the connection “${connLabel}”` })
    return NextResponse.json({ ok: true, mode: 'permanent' })
  }

  // Soft delete — move to trash, auto-purge after 7 days
  const { error } = await admin
    .from('connections')
    .update({ status: 'trashed', trashed_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent({ ...auditCtx, action: 'connector.trashed', summary: `Moved the connection “${connLabel}” to Trash` })
  return NextResponse.json({ ok: true, mode: 'trash', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
}

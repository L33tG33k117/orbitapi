import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateToken, generateSigningSecret } from '@/lib/webhooks'
import { MCP_ENDPOINT_NAME } from '@/lib/mcp'

// Manage the workspace's single MCP endpoint. It lives as a reserved row in
// webhook_endpoints (name '__mcp__') so no migration is needed; the webhooks
// UI and the /api/hooks receiver exclude it. Admin/owner only for writes.

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership) return { error: NextResponse.json({ error: 'No workspace' }, { status: 403 }) }
  return { user, membership }
}

export async function GET() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webhook_endpoints')
    .select('id, token, enabled, created_at')
    .eq('workspace_id', ctx.membership.workspace_id)
    .eq('name', MCP_ENDPOINT_NAME)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ endpoint: data ?? null })
}

export async function POST() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  if (ctx.membership.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('webhook_endpoints')
    .select('id')
    .eq('workspace_id', ctx.membership.workspace_id)
    .eq('name', MCP_ENDPOINT_NAME)
    .maybeSingle()

  // Create or rotate: one MCP endpoint per workspace.
  const { data, error } = existing
    ? await admin
        .from('webhook_endpoints')
        .update({ token: generateToken(), enabled: true })
        .eq('id', existing.id)
        .select('id, token, enabled, created_at')
        .single()
    : await admin
        .from('webhook_endpoints')
        .insert({
          workspace_id: ctx.membership.workspace_id,
          name: MCP_ENDPOINT_NAME,
          token: generateToken(),
          signing_secret: generateSigningSecret(), // required column; unused by MCP
          target_type: 'event',
          require_signature: false,
          created_by: ctx.user.id,
        })
        .select('id, token, enabled, created_at')
        .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ endpoint: data })
}

export async function DELETE() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  if (ctx.membership.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('webhook_endpoints')
    .update({ enabled: false })
    .eq('workspace_id', ctx.membership.workspace_id)
    .eq('name', MCP_ENDPOINT_NAME)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

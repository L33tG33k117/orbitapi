import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateToken } from '@/lib/webhooks'
import { isMissingTable } from '@/lib/mcp'

// Manage the workspace's single MCP endpoint. Admin/owner only for writes.
// If migration 048 hasn't been applied, GET reports { migrationNeeded: true }
// so the UI can explain instead of erroring.

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
    .from('mcp_endpoints')
    .select('id, token, enabled, created_at, last_used_at')
    .eq('workspace_id', ctx.membership.workspace_id)
    .maybeSingle()

  if (error && isMissingTable(error)) return NextResponse.json({ migrationNeeded: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ endpoint: data ?? null })
}

export async function POST() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  if (ctx.membership.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  // Create or rotate: one endpoint per workspace, so upsert on workspace_id.
  const { data, error } = await admin
    .from('mcp_endpoints')
    .upsert(
      {
        workspace_id: ctx.membership.workspace_id,
        token: generateToken(),
        enabled: true,
        created_by: ctx.user.id,
      },
      { onConflict: 'workspace_id' },
    )
    .select('id, token, enabled, created_at, last_used_at')
    .single()

  if (error && isMissingTable(error)) return NextResponse.json({ migrationNeeded: true }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ endpoint: data })
}

export async function DELETE() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  if (ctx.membership.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('mcp_endpoints')
    .update({ enabled: false })
    .eq('workspace_id', ctx.membership.workspace_id)

  if (error && !isMissingTable(error)) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

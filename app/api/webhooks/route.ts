import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateToken, generateSigningSecret } from '@/lib/webhooks'
import { capabilityGuard } from '@/lib/workspace-features'

// NOTE: the legacy receiver lives at /api/webhooks/skills/[id]; this collection
// route manages the new first-class endpoint registry (Foundation D / #10).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('webhook_endpoints')
    .select('*')
    .eq('workspace_id', membership.workspace_id)
    .neq('name', '__mcp__') // reserved row for the MCP endpoint, not a webhook
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const denied = await capabilityGuard('webhooks')
  if (denied) return denied

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webhook_endpoints')
    .insert({
      workspace_id: membership.workspace_id,
      name: body.name.trim(),
      token: generateToken(),
      signing_secret: generateSigningSecret(),
      target_type: body.target_type ?? 'event',
      target_id: body.target_id ?? null,
      event_name: body.event_name ?? null,
      payload_schema: body.payload_schema ?? null,
      require_signature: body.require_signature ?? true,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

async function authorize(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return { error: 'Forbidden', status: 403 as const }

  const admin = createAdminClient()
  const { data: endpoint } = await admin.from('webhook_endpoints').select('*').eq('id', id).single()
  if (!endpoint || endpoint.workspace_id !== membership.workspace_id) {
    return { error: 'Not found', status: 404 as const }
  }
  return { admin, endpoint }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { data: deliveries } = await ctx.admin
    .from('webhook_deliveries')
    .select('id, status, signature_valid, dispatch_summary, error, is_replay, received_at, payload')
    .eq('endpoint_id', id)
    .order('received_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ...ctx.endpoint, deliveries: deliveries ?? [] })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  for (const key of ['name', 'target_type', 'target_id', 'event_name', 'payload_schema', 'enabled', 'require_signature']) {
    if (key in body) patch[key] = body[key]
  }
  // Allow rotating the signing secret on request.
  if (body.rotate_secret) {
    const { generateSigningSecret } = await import('@/lib/webhooks')
    patch.signing_secret = generateSigningSecret()
  }

  const { data, error } = await ctx.admin.from('webhook_endpoints').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { error } = await ctx.admin.from('webhook_endpoints').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

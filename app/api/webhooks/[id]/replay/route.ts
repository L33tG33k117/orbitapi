import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchWebhook } from '@/lib/webhook-dispatch'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

// Replay-test a past delivery from the dashboard (#10): re-dispatch a stored
// payload and log it as a new delivery flagged is_replay.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: endpoint } = await admin.from('webhook_endpoints').select('*').eq('id', id).single()
  if (!endpoint || endpoint.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Payload: an explicit one from the request body, else the most recent delivery's.
  const body = await req.json().catch(() => ({}))
  let payload: Record<string, unknown> = body?.payload ?? {}
  if (!body?.payload) {
    const { data: last } = await admin
      .from('webhook_deliveries')
      .select('payload')
      .eq('endpoint_id', id)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    payload = (last?.payload as Record<string, unknown>) ?? {}
  }

  const { data: delivery } = await admin
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpoint.id,
      workspace_id: endpoint.workspace_id,
      payload,
      signature_valid: true, // replays are operator-initiated and trusted
      status: 'received',
      is_replay: true,
    })
    .select('id')
    .single()

  try {
    const summary = await dispatchWebhook(endpoint, payload)
    if (delivery) {
      await admin.from('webhook_deliveries')
        .update({ status: 'dispatched', dispatch_summary: summary })
        .eq('id', delivery.id)
    }
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    if (delivery) {
      await admin.from('webhook_deliveries')
        .update({ status: 'failed', error: String(err).slice(0, 1000) })
        .eq('id', delivery.id)
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySignature, SIGNATURE_HEADER } from '@/lib/webhooks'
import { dispatchWebhook } from '@/lib/webhook-dispatch'

export const maxDuration = 300

type Params = { params: Promise<{ token: string }> }

// Inbound webhook receiver: POST /api/hooks/{token}
// Signature (when required) goes in the X-Orbit-Signature header, never the URL.
export async function POST(req: Request, { params }: Params) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: endpoint } = await admin
    .from('webhook_endpoints')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  // Don't leak which tokens exist.
  if (!endpoint || !endpoint.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rawBody = await req.text()
  let payload: Record<string, unknown> = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    payload = { __raw: rawBody.slice(0, 2000) }
  }

  const sigHeader = req.headers.get(SIGNATURE_HEADER)
  const signatureValid = verifySignature(endpoint.signing_secret, rawBody, sigHeader)

  // Capture a safe subset of headers for the dashboard.
  const headers: Record<string, string> = {}
  for (const [k, v] of req.headers.entries()) {
    if (['authorization', 'cookie'].includes(k.toLowerCase())) continue
    headers[k] = v
  }

  // Always log the delivery first so the dashboard shows rejects too.
  const { data: delivery } = await admin
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpoint.id,
      workspace_id: endpoint.workspace_id,
      source_ip: req.headers.get('x-forwarded-for') ?? null,
      headers,
      payload,
      signature_valid: signatureValid,
      status: 'received',
    })
    .select('id')
    .single()

  await admin.from('webhook_endpoints')
    .update({ last_delivery_at: new Date().toISOString() })
    .eq('id', endpoint.id)

  // Enforce signature when required.
  if (endpoint.require_signature && !signatureValid) {
    if (delivery) {
      await admin.from('webhook_deliveries')
        .update({ status: 'rejected', error: 'Invalid or missing signature' })
        .eq('id', delivery.id)
    }
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

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
    console.error('[hook] dispatch failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

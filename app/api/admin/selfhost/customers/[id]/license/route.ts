import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { issueLicense, SigningKeyMissingError, ACTIVE_KID } from '@/lib/license-sign'
import { readLicense } from '@/lib/license'
import type { WorkspaceTier } from '@/types'

/**
 * GET — reveal the customer's current licence key.
 *
 * Separate from the list endpoint on purpose: the key is a bearer credential,
 * so it is fetched one customer at a time, by explicit action, rather than
 * being sprayed across a list response. This is also the endpoint that lets
 * support re-send a key WITHOUT re-issuing — which matters more than it looks,
 * because re-issuing bumps `iat` and the installed stale-key guard then refuses
 * the older key the customer may still be mid-way through applying.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('selfhost_customers')
    .select('license_key')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!data.license_key) return NextResponse.json({ error: 'No licence has been issued yet.' }, { status: 404 })

  return NextResponse.json({ key: data.license_key })
}

/**
 * POST — mint a licence for this customer.
 *
 * Used for the first sale and for every renewal. The customer's stored tier and
 * seats are the defaults; the request may override them for a one-off (an
 * extension at a different seat count, say) without editing the customer first.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null) as {
    months?: number
    tier?: WorkspaceTier
    seats?: number | null
    reason?: string
  } | null

  const months = body?.months ?? 12
  if (!Number.isFinite(months) || months <= 0 || months > 120) {
    return NextResponse.json({ error: 'Term must be between 1 and 120 months.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: customer, error: readError } = await admin
    .from('selfhost_customers')
    .select('id, company, contact_email, tier, seats, license_id')
    .eq('id', id)
    .single()

  if (readError || !customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tier = (body?.tier ?? customer.tier) as WorkspaceTier
  const seats = body?.seats !== undefined ? body.seats : customer.seats

  let issued
  try {
    issued = issueLicense({
      customer: customer.company,
      email: customer.contact_email,
      tier,
      seats: seats ?? undefined,
      months,
    })
  } catch (err) {
    if (err instanceof SigningKeyMissingError) {
      // The single most likely failure, and the one with a specific fix, so it
      // gets its own message instead of a generic 500.
      return NextResponse.json({
        error: 'No signing key is configured. Set LICENSE_SIGNING_KEY in the environment before issuing licences.',
      }, { status: 503 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  // Verify what we just signed, with the same code the customer's install will
  // run, before it is stored or shown to anyone. A key that our own verifier
  // rejects must never leave this building — the failure mode otherwise is a
  // customer discovering it on an air-gapped machine, which is the most
  // expensive place in the world to discover anything.
  const check = readLicense(issued.key)
  if (check.status !== 'valid') {
    return NextResponse.json({
      error: `The licence was signed but failed its own verification (${check.message}). ` +
             'The private key in LICENSE_SIGNING_KEY probably does not match the public half in lib/license.ts.',
    }, { status: 500 })
  }

  const expiresAt = new Date(issued.payload.exp * 1000).toISOString()
  const issuedAt = new Date(issued.payload.iat * 1000).toISOString()

  // History first, then the denormalised copy. In this order a crash between
  // the two leaves an orphaned history row — recoverable, and obvious. The
  // other order would leave a customer marked as licensed with no record of
  // what was actually signed for them.
  await admin.from('selfhost_license_issues').insert({
    customer_id: customer.id,
    license_id: issued.payload.lid,
    license_key: issued.key,
    tier,
    seats: seats ?? null,
    issued_at: issuedAt,
    expires_at: expiresAt,
    reason: customer.license_id ? (body?.reason ?? 'renewal') : 'new',
    kid: ACTIVE_KID,
    issued_by: user.id,
  })

  const { error: updateError } = await admin
    .from('selfhost_customers')
    .update({
      tier,
      seats: seats ?? null,
      license_id: issued.payload.lid,
      license_key: issued.key,
      license_issued_at: issuedAt,
      license_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customer.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    key: issued.key,
    licenseId: issued.payload.lid,
    tier,
    seats: seats ?? null,
    issuedAt,
    expiresAt,
  })
}

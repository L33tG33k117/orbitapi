import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readLicense } from '@/lib/license'
import { isSelfHost } from '@/lib/edition'
import { listReleases } from '@/lib/selfhost-access'

export const dynamic = 'force-dynamic'

// ============================================================
// Licence check-in
// ============================================================
// A self-hosted install asking two questions: "is my licence still good?" and
// "is there a newer version?". Optional, and impossible for an air-gapped box —
// which is the case this whole edition was built for, so a failed check-in is
// a non-event by design.
//
// Authentication is possession of a validly signed licence key. There is no
// secret to distribute: the customer already has the only credential that
// matters, and it cannot be forged without the private half of k1. The key is
// sent over TLS and never stored here — we verify it, take the licence id out
// of the payload, and discard it.
//
// What this is NOT: a security boundary. A customer who controls the server can
// block this call, and nothing in the product breaks when they do. Expiry is
// the real limit. Treat revocation as a lever, not a guarantee.
// ============================================================

export async function POST(req: NextRequest) {
  // Cloud answers check-ins; it never makes them.
  if (isSelfHost()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null) as {
    key?: string
    version?: string
    installId?: string
  } | null
  if (!body?.key) return NextResponse.json({ error: 'A licence key is required.' }, { status: 400 })

  // Verified with exactly the same code the install runs. An unsigned or
  // tampered key gets nothing — not even a "no such customer", which would
  // turn this into an oracle for guessing licence ids.
  const state = readLicense(body.key)
  if (!state.payload) {
    return NextResponse.json({ error: 'That licence key could not be verified.' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: customer } = await admin
    .from('selfhost_customers')
    .select('id, company, status, revoked_at, revoked_reason')
    .eq('license_id', state.payload.lid)
    .maybeSingle()

  // Record the sighting before deciding anything, so support can see that an
  // install is alive even when its licence was issued outside the ledger (the
  // CLI fallback in the runbook does exactly that).
  if (customer) {
    await admin
      .from('selfhost_customers')
      .update({
        last_checkin_at: new Date().toISOString(),
        last_seen_version: body.version ?? null,
        install_id: body.installId ?? null,
      })
      .eq('id', customer.id)
      .then(undefined, () => {})
  }

  const revoked = !!customer?.revoked_at

  // Latest version regardless of revocation: knowing an update exists is not a
  // privilege, and withholding it from a lapsed customer only makes their
  // eventual renewal harder to support.
  const releases = await listReleases()
  const latestVersion = releases[0]?.version ?? null

  return NextResponse.json({
    status: revoked ? 'revoked' : 'ok',
    // Shown verbatim to the customer's administrator, so it has to read like
    // something a person wrote — this is often the first they hear of it.
    message: revoked
      ? (customer?.revoked_reason?.trim()
        || 'This licence has been withdrawn. Please contact OrbitAPI support.')
      : '',
    latestVersion,
    // Echoed back so an install can confirm the answer is about its own
    // licence and not a stale cached response from somewhere in between.
    licenseId: state.payload.lid,
  })
}

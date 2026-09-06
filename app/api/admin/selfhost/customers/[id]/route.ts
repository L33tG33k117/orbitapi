import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

const TIERS = ['free', 'starter', 'pro', 'enterprise']
const STATUSES = ['active', 'suspended', 'churned']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Allow-list rather than spreading the body: `license_key`, `license_id` and
  // the expiry are set ONLY by the issue route, from a signature we produced.
  // If they were patchable, an admin could type an expiry that the signed key
  // does not actually grant, and the ledger would start lying about what is
  // deployed in the field.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.company === 'string' && body.company.trim()) patch.company = body.company.trim()
  if (typeof body.contactName === 'string') patch.contact_name = body.contactName.trim() || null
  if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null
  if (typeof body.downloadsEnabled === 'boolean') patch.downloads_enabled = body.downloadsEnabled

  if (typeof body.contactEmail === 'string') {
    const email = body.contactEmail.trim().toLowerCase()
    if (!email.includes('@')) return NextResponse.json({ error: 'That email does not look valid.' }, { status: 400 })
    patch.contact_email = email
  }

  if (typeof body.tier === 'string') {
    if (!TIERS.includes(body.tier)) return NextResponse.json({ error: 'Unknown tier.' }, { status: 400 })
    // Changing the tier here changes what the NEXT licence will grant. It does
    // not alter the key already in the field — only re-issuing does that, which
    // is why the UI says "takes effect on the next licence".
    patch.tier = body.tier
  }

  if (body.seats !== undefined) {
    const seats = body.seats
    if (seats !== null && (!Number.isInteger(seats) || (seats as number) <= 0)) {
      return NextResponse.json({ error: 'Seats must be a whole number greater than zero.' }, { status: 400 })
    }
    patch.seats = seats
  }

  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
    patch.status = body.status
  }

  const admin = createAdminClient()
  const { error } = await admin.from('selfhost_customers').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Deleting the customer cascades to their issue history (056). That is the
  // right call for a row created by mistake, and the wrong one for a customer
  // who left — hence the UI offers "churned" first and hides delete behind a
  // confirm. A licence already in the field keeps working either way: it is
  // signed, and nothing about it is checked against this table.
  const { error } = await admin.from('selfhost_customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

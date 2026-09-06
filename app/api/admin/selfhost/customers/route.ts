import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { canIssueLicenses } from '@/lib/license-sign'

// Self-hosted customer ledger. Cloud-only by construction: `selfhost_customers`
// exists in the hosted database and nowhere else.

const TIERS = ['free', 'starter', 'pro', 'enterprise']

/**
 * Never return `license_key` from the list endpoint.
 *
 * A licence key is a bearer credential — anyone holding it can license an
 * install. The list is rendered in a browser and would put every customer's
 * key into one response, so the key is fetched deliberately, one customer at a
 * time, from the reveal endpoint. Same reasoning as never returning a stored
 * API key from a settings page.
 */
const LIST_COLUMNS =
  'id, company, contact_name, contact_email, user_id, tier, seats, ' +
  'downloads_enabled, status, notes, license_id, license_issued_at, ' +
  'license_expires_at, created_at, updated_at'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('selfhost_customers')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500)

  // Graceful before migration 056 is applied, matching how the rest of admin
  // behaves: an empty ledger and a usable page beats a 500 and a blank screen.
  if (error) {
    return NextResponse.json({ customers: [], canIssue: false, migrated: false })
  }

  return NextResponse.json({
    customers: data ?? [],
    // Drives the "you can't issue yet, here's why" notice rather than letting
    // the admin fill in a form and only then discover it can't be signed.
    canIssue: canIssueLicenses(),
    migrated: true,
  })
}

export async function POST(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as {
    company?: string
    contactName?: string
    contactEmail?: string
    tier?: string
    seats?: number | null
    notes?: string
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const company = body.company?.trim()
  const contactEmail = body.contactEmail?.trim().toLowerCase()
  if (!company) return NextResponse.json({ error: 'A company name is required.' }, { status: 400 })
  if (!contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'A valid contact email is required.' }, { status: 400 })
  }

  const tier = body.tier ?? 'enterprise'
  if (!TIERS.includes(tier)) return NextResponse.json({ error: 'Unknown tier.' }, { status: 400 })

  const seats = body.seats ?? null
  if (seats !== null && (!Number.isInteger(seats) || seats <= 0)) {
    return NextResponse.json({ error: 'Seats must be a whole number greater than zero.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Link to a cloud account if one already exists for that address. This is
  // what makes the downloads page work the moment they sign in, with no second
  // admin step to remember. If they have not signed up yet, the downloads page
  // falls back to matching on email, and this stays null harmlessly.
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', contactEmail)
    .maybeSingle()

  const { data, error } = await admin
    .from('selfhost_customers')
    .insert({
      company,
      contact_name: body.contactName?.trim() || null,
      contact_email: contactEmail,
      user_id: profile?.id ?? null,
      tier,
      seats,
      notes: body.notes?.trim() || null,
    })
    .select(LIST_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

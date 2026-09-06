import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSelfhostAccess } from '@/lib/selfhost-access'
import { isSelfHost } from '@/lib/edition'

export const dynamic = 'force-dynamic'

/**
 * The customer fetching their own licence key.
 *
 * This is the whole point of self-service: a key lives in an email from months
 * ago, the person who received it has left, and the alternative to this
 * endpoint is a support ticket. They already hold this credential — handing it
 * back to them is not a disclosure.
 *
 * Fetched on demand rather than included in the page, so the key is not sitting
 * in the HTML of a tab left open on a shared screen.
 */
export async function GET() {
  if (isSelfHost()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Revoked and suspended customers fail this check, so a withdrawn licence
  // cannot be re-fetched after the fact.
  const access = await getSelfhostAccess(user.id, user.email)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('selfhost_customers')
    .select('license_key, license_expires_at, tier, seats')
    .eq('id', access.customerId)
    .single()

  if (!data?.license_key) {
    return NextResponse.json({
      error: 'No licence has been issued for your account yet. Please contact support.',
    }, { status: 404 })
  }

  return NextResponse.json({
    key: data.license_key,
    expiresAt: data.license_expires_at,
    tier: data.tier,
    seats: data.seats,
  })
}

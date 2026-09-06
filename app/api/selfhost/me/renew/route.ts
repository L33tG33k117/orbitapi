import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSelfhostAccess } from '@/lib/selfhost-access'
import { isSelfHost } from '@/lib/edition'

export const dynamic = 'force-dynamic'

/**
 * "I'd like to renew."
 *
 * A request, not a transaction: money stays a conversation, but finding the
 * right person to have it with should not be the customer's problem. This lands
 * as a badge in Admin → Self-hosted, where renewing is one button.
 */
export async function POST(req: NextRequest) {
  if (isSelfHost()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getSelfhostAccess(user.id, user.email)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null) as { note?: string } | null
  // Trimmed hard: this is a free-text field on a page we do not control the
  // audience of, and it is rendered in the admin UI.
  const note = body?.note?.trim().slice(0, 1000) || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('selfhost_customers')
    .update({
      // Re-requesting refreshes the timestamp rather than being rejected — a
      // customer chasing a renewal that went quiet should move up the list, not
      // be told they already asked.
      renewal_requested_at: new Date().toISOString(),
      renewal_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', access.customerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

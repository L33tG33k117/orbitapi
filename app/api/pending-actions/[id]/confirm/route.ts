import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePendingAction, outcomeBody } from '@/lib/pending-actions'
import { explainActionError } from '@/lib/action-errors'

type Params = { params: Promise<{ id: string }> }

// Chat confirmation card → run the staged action (or resume a parked playbook).
// Always answers with JSON, including on failure, so the card can show what
// went wrong and how to fix it instead of sitting in "pending".
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Must belong to this user and still be pending
  const { data: pending } = await admin
    .from('pending_actions')
    .select('*, connection:connections(*, connector:connectors(slug))')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!pending) {
    return NextResponse.json({
      ok: false, status: 'not_found', error: 'Not found or already resolved',
      explained: { kind: 'unknown', title: 'This request was already handled or no longer exists.', hint: 'Check the Approvals page for its current status.', fixHref: '/approvals', fixLabel: 'Open Approvals' },
    }, { status: 404 })
  }

  if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
    await admin.from('pending_actions').update({ status: 'expired' }).eq('id', id)
    return NextResponse.json({
      ok: false, status: 'expired', error: 'Action has expired',
      explained: { ...explainActionError('expired'), kind: 'unknown', title: 'This request expired before it was approved.', hint: 'Nothing was changed. Ask the assistant to set it up again.' },
    }, { status: 410 })
  }

  const outcome = await resolvePendingAction({ pending, approved: true, actorId: user.id })
  return NextResponse.json(outcomeBody(outcome), { status: outcome.ok ? 200 : outcome.httpStatus })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePendingAction, outcomeBody } from '@/lib/pending-actions'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // #9 — optional rollback reasoning captured at approval time for destructive actions.
  const body = await req.json().catch(() => ({}))
  const rollbackReasoning: string | undefined = body?.rollback_reasoning

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  if (membership.role === 'member') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: pending } = await admin
    .from('pending_actions')
    .select('*, connection:connections(*, connector:connectors(slug))')
    .eq('id', id)
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'pending')
    .single()

  if (!pending) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })

  if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
    await admin.from('pending_actions').update({ status: 'expired' }).eq('id', id)
    return NextResponse.json({ error: 'Action has expired' }, { status: 410 })
  }

  // Shared with the chat card: resumes playbook gates instead of executing them
  // directly (which used to leave the run waiting forever), and never throws.
  const outcome = await resolvePendingAction({ pending, approved: true, actorId: user.id, rollbackReasoning })
  return NextResponse.json(outcomeBody(outcome), { status: outcome.ok ? 200 : outcome.httpStatus })
}

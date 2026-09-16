import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePendingAction } from '@/lib/pending-actions'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('pending_actions')
    .select('*, connection:connections(*, connector:connectors(slug))')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  // Already resolved (or not ours): nothing to do, same as before.
  if (!pending) return new Response(null, { status: 204 })

  // Rejecting also halts a parked playbook run.
  await resolvePendingAction({ pending, approved: false, actorId: user.id })
  return new Response(null, { status: 204 })
}

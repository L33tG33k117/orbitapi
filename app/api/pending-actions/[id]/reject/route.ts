import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resumePlaybookRun } from '@/lib/playbook-runner'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Load first so we can resolve a linked playbook run before status flips.
  const { data: pending } = await admin
    .from('pending_actions')
    .select('params')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  const { error } = await admin
    .from('pending_actions')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If this gated a playbook run, halt that run cleanly.
  const playbookRunId = (pending?.params as Record<string, unknown> | undefined)?.__playbook_run as string | undefined
  if (playbookRunId) {
    await resumePlaybookRun({ runId: playbookRunId, approved: false })
  }

  return new Response(null, { status: 204 })
}

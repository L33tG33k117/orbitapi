import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({ connectionIds: z.array(z.string()).min(1).max(30) })

// Flip real-mode connections that have NO credentials over to Simulation, so
// an unfinished setup (e.g. a fresh bundle install) can be tested with sample
// data right away. Deliberately only touches credential-less connections — a
// connection someone entered real credentials for is never silently converted.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('connections')
    .select('id, label, is_simulated, vault_secret_id')
    .in('id', parsed.data.connectionIds)
    .eq('workspace_id', membership.workspace_id)
    .neq('status', 'trashed')

  const targets = (conns ?? []).filter(c => !c.is_simulated && !c.vault_secret_id)
  if (targets.length) {
    const { error } = await admin
      .from('connections')
      .update({ is_simulated: true })
      .in('id', targets.map(t => t.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditEvent({
      workspaceId: membership.workspace_id,
      userId: user.id,
      category: 'connector',
      action: 'switch_to_simulation',
      target: targets.map(t => t.label).join(', '),
      summary: `Switched ${targets.map(t => `“${t.label}”`).join(', ')} to Simulation (no credentials were set up)`,
    })
  }

  return NextResponse.json({ ok: true, updated: targets.map(t => t.id) })
}

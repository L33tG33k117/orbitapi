import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const { data: skill } = await admin.from('skills').select('workspace_id').eq('id', id).single()
  if (!skill || skill.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: runs } = await admin
    .from('skill_runs')
    .select('id, mode, status, triggered_by, started_at, completed_at, steps, prompt')
    .eq('skill_id', id)
    .order('started_at', { ascending: false })
    .limit(20)

  return NextResponse.json(runs ?? [])
}

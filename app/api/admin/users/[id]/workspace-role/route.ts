import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  workspaceId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: userId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId, role } = parsed.data
  const admin = createAdminClient()

  // Verify the membership exists
  const { data: existing } = await admin
    .from('memberships')
    .select('id, role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })

  const { data, error } = await admin
    .from('memberships')
    .update({ role })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .select('id, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, role: data.role })
}

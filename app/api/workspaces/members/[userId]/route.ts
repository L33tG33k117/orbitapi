import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const patchSchema = z.object({
  workspaceId: z.string().uuid(),
  role: z.enum(['admin', 'member']),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId, role } = parsed.data

  // Permission check via regular client
  const { data: caller } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Write via admin client
  const admin = createAdminClient()
  const { error } = await admin
    .from('memberships')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .neq('role', 'owner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const url = new URL(request.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Permission check via regular client
  const { data: caller } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Write via admin client
  const admin = createAdminClient()
  const { error } = await admin
    .from('memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .neq('role', 'owner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

// Look up a member's email for a human-readable governance summary.
async function memberEmail(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('email').eq('id', userId).single()
  return (data as { email?: string } | null)?.email ?? 'a member'
}

const patchSchema = z.union([
  z.object({
    workspaceId: z.string().uuid(),
    role: z.enum(['admin', 'member']),
    customRoleId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    workspaceId: z.string().uuid(),
    suspend: z.boolean(),
    suspensionReason: z.string().max(500).optional(),
  }),
])

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId } = parsed.data

  const { data: caller } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'owner' && caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  if ('suspend' in parsed.data) {
    const { suspend, suspensionReason } = parsed.data
    const update: Record<string, unknown> = {
      suspended_at: suspend ? new Date().toISOString() : null,
      suspension_reason: suspend ? (suspensionReason ?? null) : null,
    }
    const { error } = await admin
      .from('memberships')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .neq('role', 'owner')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const email = await memberEmail(admin, userId)
    await logAuditEvent({ workspaceId, userId: user.id, actorEmail: user.email, category: 'members',
      action: suspend ? 'member.suspended' : 'member.unsuspended', target: email,
      summary: `${suspend ? 'Suspended' : 'Un-suspended'} ${email}${suspend && suspensionReason ? ` — ${suspensionReason}` : ''}` })
    return NextResponse.json({ ok: true })
  }

  // role change — only owner can do this
  if (caller?.role !== 'owner') {
    return NextResponse.json({ error: 'Only workspace owner can change roles' }, { status: 403 })
  }

  const { role, customRoleId } = parsed.data as { workspaceId: string; role: 'admin' | 'member'; customRoleId?: string | null }
  const { error } = await admin
    .from('memberships')
    .update({ role, custom_role_id: customRoleId ?? null })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .neq('role', 'owner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const email = await memberEmail(admin, userId)
  await logAuditEvent({ workspaceId, userId: user.id, actorEmail: user.email, category: 'members',
    action: 'member.role_changed', target: email, summary: `Changed ${email}'s role to ${role}`, metadata: { role } })
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

  const { data: caller } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const email = await memberEmail(admin, userId)
  const { error } = await admin
    .from('memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .neq('role', 'owner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent({ workspaceId, userId: user.id, actorEmail: user.email, category: 'members',
    action: 'member.removed', target: email, summary: `Removed ${email} from the workspace` })
  return NextResponse.json({ ok: true })
}

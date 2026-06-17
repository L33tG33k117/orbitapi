import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH: toggle super_admin flag or other profile fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as { super_admin?: boolean }

  const admin = createAdminClient()

  if (body.super_admin === false) {
    // Prevent removing your own super_admin status
    if (id === caller.id) {
      return NextResponse.json({ error: 'Cannot remove your own Super Admin status' }, { status: 400 })
    }

    // Enforce: at least one Super Admin must always remain
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('super_admin', true)

    if ((count ?? 0) <= 1) {
      return NextResponse.json({
        error: 'Cannot remove the last Super Admin. Promote another user to Super Admin first.',
      }, { status: 400 })
    }
  }

  const { data, error } = await admin
    .from('profiles')
    .update({ super_admin: body.super_admin })
    .eq('id', id)
    .select('id, email, super_admin')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: send password reset email
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('email').eq('id', id).single()
  if (!profile?.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action_link: data.properties?.action_link ?? null, email: profile.email })
}

// DELETE: remove a user — only allowed if they are NOT an owner of any workspace
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Super admin cannot delete themselves via this route
  if (id === caller.id) {
    return NextResponse.json({ error: 'Cannot delete your own account from here. Use account settings.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Block deletion if the user is an owner of any non-sandbox workspace
  const { data: ownerMemberships } = await admin
    .from('memberships')
    .select('workspace_id, workspaces(is_sandbox)')
    .eq('user_id', id)
    .eq('role', 'owner')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownsRealWorkspace = (ownerMemberships ?? []).some((m: any) => !m.workspaces?.is_sandbox)
  if (ownsRealWorkspace) {
    return NextResponse.json({
      error: 'Cannot delete a workspace owner. The user must transfer ownership or delete their workspace first.',
    }, { status: 400 })
  }

  // Delete the auth user (cascades to profiles, memberships, connections, etc.)
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: id })
}

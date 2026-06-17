import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-guard'

export async function POST(request: Request) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetUserId } = await request.json()
  if (!targetUserId) return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', targetUserId)
    .single()

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Log the impersonation
  await admin.from('impersonation_log').insert({
    admin_id: user.id,
    target_user_id: targetUserId,
    target_email: target.email,
  })

  const cookieStore = await cookies()
  cookieStore.set('__orbit_imp', targetUserId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  return NextResponse.json({ ok: true, target })
}

export async function DELETE() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()

  // Update impersonation log with ended_at
  const admin = createAdminClient()
  await admin
    .from('impersonation_log')
    .update({ ended_at: new Date().toISOString() })
    .eq('admin_id', user.id)
    .is('ended_at', null)

  cookieStore.delete('__orbit_imp')
  return NextResponse.json({ ok: true })
}

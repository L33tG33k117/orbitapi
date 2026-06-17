import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password, confirmPhrase } = await req.json() as { password?: string; confirmPhrase?: string }

  // Require typing "DELETE MY ACCOUNT" as a second safeguard
  if (confirmPhrase !== 'DELETE MY ACCOUNT') {
    return NextResponse.json({ error: 'Confirmation phrase does not match.' }, { status: 400 })
  }

  // Re-authenticate to confirm the user knows their password
  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  }

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (authErr) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  // If user is a super admin, block deletion unless another SA exists
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('super_admin').eq('id', user.id).single()

  if (profile?.super_admin) {
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('super_admin', true)
    if ((count ?? 0) <= 1) {
      return NextResponse.json({
        error: 'You are the last Super Admin. Promote another Super Admin before deleting your account.',
      }, { status: 400 })
    }
  }

  // Delete the auth user — cascades to all user data via FK constraints
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

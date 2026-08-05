import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'

export async function POST(req: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await req.json() as { email?: string }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const siteUrl = getAppUrl(process.env.NEXT_PUBLIC_SITE_URL)

  // Send Supabase auth invite — creates the user in auth.users immediately
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/onboarding`,
  })

  if (inviteErr) {
    // User already exists — try to look them up and just set the flag
    if (inviteErr.message?.toLowerCase().includes('already')) {
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (existing) {
        await admin.from('profiles').update({ super_admin: true }).eq('id', existing.id)
        return NextResponse.json({ ok: true, email, alreadyExisted: true })
      }
    }
    return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  }

  const userId = invited.user?.id
  if (!userId) return NextResponse.json({ error: 'Invite sent but no user ID returned' }, { status: 500 })

  // Upsert profile so super_admin = true when they first log in
  await admin.from('profiles').upsert(
    { id: userId, email, super_admin: true },
    { onConflict: 'id' }
  )

  // Record the invite
  await admin.from('super_admin_invites').upsert(
    { email, invited_by: caller.id, accepted: false },
    { onConflict: 'email' }
  )

  return NextResponse.json({ ok: true, email, userId })
}

import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { isSelfHost } from '@/lib/edition'
import { getAppUrl } from '@/lib/app-url'
import { z } from 'zod'

const schema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
  customRoleId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  // Auth + permission check via regular (RLS-enforced) client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId, email, role, customRoleId } = parsed.data

  const { data: callerMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!callerMembership || callerMembership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Look up invitee and write membership via admin client
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  let inviteeId = existing?.id
  // A link the admin can pass on by hand. Only produced on self-host, where
  // there may be no SMTP to send anything.
  let setupLink: string | null = null

  if (!inviteeId) {
    // On cloud, people sign themselves up and the admin then adds them.
    if (!isSelfHost()) {
      return NextResponse.json(
        { error: 'No user found with that email. They must sign up first.' },
        { status: 404 }
      )
    }

    // On self-host, public signup is disabled — so telling an admin their
    // colleague must "sign up first" would describe something impossible.
    // The admin creates the account here instead.
    //
    // The password is random and never shown: the person sets their own via
    // the recovery link below. That avoids an admin inventing a password,
    // sending it over chat, and it never being changed.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(32).toString('base64url'),
      email_confirm: true,
      user_metadata: { full_name: email },
    })
    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Could not create that account.' },
        { status: 400 },
      )
    }
    inviteeId = created.user.id

    // generateLink returns the URL instead of mailing it, which is exactly
    // what a server with no outbound email needs. If SMTP IS configured the
    // user also gets the email; the link is simply a fallback.
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${getAppUrl()}/api/auth/callback` },
    })
    setupLink = link?.properties?.action_link ?? null
  }

  const invitee = { id: inviteeId }

  const { error } = await admin
    .from('memberships')
    .upsert(
      { workspace_id: workspaceId, user_id: invitee.id, role, custom_role_id: customRoleId ?? null },
      { onConflict: 'workspace_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent({ workspaceId, userId: user.id, actorEmail: user.email, category: 'members',
    action: 'member.added', target: email, summary: `Added ${email} to the workspace as ${role}`, metadata: { role } })
  // setupLink is only ever non-null on self-host for a newly created account.
  return NextResponse.json({ ok: true, setupLink })
}

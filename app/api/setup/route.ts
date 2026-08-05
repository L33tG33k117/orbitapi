import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { markSetupComplete, needsFirstRunSetup } from '@/lib/setup-state'
import { logAuditEvent } from '@/lib/audit'

// ============================================================
// First-run setup
// ============================================================
// Creates the very first administrator on a self-hosted install.
//
// This endpoint is UNAUTHENTICATED by necessity — there is nobody to
// authenticate as yet. Its only protection is that it refuses to do anything
// once a single profile exists, so the window is exactly one account wide and
// closes permanently the moment it is used.
// ============================================================

export async function GET() {
  if (!isSelfHost()) return NextResponse.json({ needsSetup: false })
  return NextResponse.json({ needsSetup: await needsFirstRunSetup() })
}

export async function POST(req: Request) {
  // Cloud has public signup; an open account-creation endpoint there would be
  // a straightforward way to mint an owner account on someone's workspace.
  if (!isSelfHost()) {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  }
  if (!(await needsFirstRunSetup())) {
    return NextResponse.json(
      { error: 'This installation has already been set up. Sign in instead.' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.fullName ?? '').trim()
  const workspaceName = String(body.workspaceName ?? '').trim() || 'My Workspace'

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  // This account is the keys to the whole installation and there is no
  // password-reset email on a box with no SMTP, so a weak one is expensive.
  if (password.length < 12) {
    return NextResponse.json(
      { error: 'Use a password of at least 12 characters. There may be no way to email a reset from this server.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // email_confirm skips the verification mail — an air-gapped box usually has
  // no SMTP, and an unconfirmed first admin could never sign in.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email, workspace_name: workspaceName },
  })

  if (error || !data?.user) {
    return NextResponse.json(
      { error: error?.message ?? 'Could not create the administrator account.' },
      { status: 400 },
    )
  }

  // The on_auth_user_created trigger provisions the profile, the workspace and
  // an owner membership from that metadata — the same path a cloud signup
  // takes, so there is one provisioning code path rather than two.
  markSetupComplete()

  const { data: membership } = await admin
    .from('memberships').select('workspace_id').eq('user_id', data.user.id).maybeSingle()

  await logAuditEvent({
    workspaceId: membership?.workspace_id,
    userId: data.user.id,
    actorEmail: email,
    category: 'workspace',
    action: 'instance.setup_completed',
    summary: `Installation set up by ${email}`,
  })

  return NextResponse.json({ ok: true })
}

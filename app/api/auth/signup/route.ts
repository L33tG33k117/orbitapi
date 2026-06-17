import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-side signup so the closed-beta invite code is enforced before any
// account is created. When SIGNUP_INVITE_CODE is unset, signup is open.
export async function POST(req: Request) {
  const { email, password, fullName, workspaceName, inviteCode } = await req.json() as {
    email?: string; password?: string; fullName?: string; workspaceName?: string; inviteCode?: string
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const required = process.env.SIGNUP_INVITE_CODE
  if (required && inviteCode?.trim() !== required) {
    return NextResponse.json({ error: 'A valid invite code is required to sign up.' }, { status: 403 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, workspace_name: workspaceName },
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

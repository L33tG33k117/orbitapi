import { NextResponse } from 'next/server'

// Tells the signup form whether a closed-beta invite code is required.
// (The code itself is never sent to the client.)
export async function GET() {
  return NextResponse.json({ inviteRequired: !!process.env.SIGNUP_INVITE_CODE })
}

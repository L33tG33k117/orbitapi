import { NextResponse } from 'next/server'
import { cronAuthorized, cronRejectionReason, runDueSkills } from '@/lib/cron-jobs'

// Allow up to 5 minutes for parallel skill runs
export const maxDuration = 300

// The HTTP entry point for scheduled skills, used by Vercel Cron. The work
// itself lives in lib/cron-jobs.ts so the self-hosted in-process scheduler can
// call it directly, without an HTTP round trip to itself.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: cronRejectionReason() }, { status: 401 })
  }
  return NextResponse.json(await runDueSkills())
}

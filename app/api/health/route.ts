import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { edition } from '@/lib/edition'

export const dynamic = 'force-dynamic'

// Liveness + readiness for the self-hosted container's healthcheck, and a
// quick "is this instance actually working" probe for support.
//
// It touches the DATABASE on purpose. A health check that only proves the
// Node process is listening is the kind that stays green while every page
// 500s, which is precisely the failure an air-gapped operator can't debug.
//
// Deliberately says almost nothing: version and edition only. It's reachable
// without auth, so it must not become a fingerprinting surface.
export async function GET() {
  const started = Date.now()

  let dbOk = false
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('workspaces').select('id', { head: true, count: 'exact' }).limit(1)
    dbOk = !error
  } catch {
    dbOk = false
  }

  const body = {
    status: dbOk ? 'ok' : 'degraded',
    edition: edition(),
    version: process.env.ORBIT_VERSION ?? 'dev',
    checks: { database: dbOk ? 'ok' : 'unreachable' },
    ms: Date.now() - started,
  }

  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}

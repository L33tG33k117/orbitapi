import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { runLicenseCheckin } from '@/lib/license-checkin'
import { invalidateLicenseCache } from '@/lib/license-state'

// The install's own control over checking in: turn it off, or run one now.
// Admin-only, self-host only — the mirror of /api/selfhost/checkin, which is
// the cloud side that answers.

async function adminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return null
  return { user }
}

/** Turn check-in on or off. */
export async function PUT(req: Request) {
  if (!isSelfHost()) return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  if (!await adminContext()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as { enabled?: boolean } | null
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const patch: Record<string, unknown> = {
    checkin_enabled: body.enabled,
    updated_at: new Date().toISOString(),
  }

  // Turning check-in off clears any cached verdict. Otherwise a customer who
  // was revoked, then disabled check-in, would stay revoked forever with no way
  // for us to lift it — and, worse, an install would keep enforcing a decision
  // it can no longer hear us reverse.
  if (!body.enabled) {
    patch.checkin_status = null
    patch.checkin_message = null
  }

  const { error } = await admin.from('instance_settings').update(patch).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateLicenseCache()
  return NextResponse.json({ ok: true, enabled: body.enabled })
}

/** Check in right now, rather than waiting for the nightly run. */
export async function POST() {
  if (!isSelfHost()) return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  if (!await adminContext()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runLicenseCheckin()
  invalidateLicenseCache()

  return NextResponse.json({
    status: result.status,
    message: result.message,
    latestVersion: result.latestVersion,
  })
}

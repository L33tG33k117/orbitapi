import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { readLicense, licenseBanner } from '@/lib/license'
import { getLicenseState, invalidateLicenseCache } from '@/lib/license-state'
import { logAuditEvent } from '@/lib/audit'

// Licence management. Admin-only, self-host only.
//
// GET  current state (never returns the key itself)
// POST apply a new key — validates and diffs BEFORE storing

async function adminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return null
  return { user, workspaceId: membership.workspace_id }
}

export async function GET() {
  if (!isSelfHost()) return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  const ctx = await adminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const state = await getLicenseState()
  return NextResponse.json({
    status: state.status,
    // The key is never sent back: it is a bearer credential, and an admin
    // screen has no reason to display one.
    customer: state.payload?.customer ?? null,
    tier: state.payload?.tier ?? null,
    seats: state.payload?.limits?.seats ?? null,
    expiresAt: state.payload ? new Date(state.payload.exp * 1000).toISOString() : null,
    daysRemaining: state.daysRemaining,
    message: state.message,
    banner: licenseBanner(state),
  })
}

export async function POST(req: Request) {
  if (!isSelfHost()) return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  const ctx = await adminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const key = String(body.key ?? '').trim()
  if (!key) return NextResponse.json({ error: 'Paste your licence key.' }, { status: 400 })

  // Verify before storing, so a bad key can never take an instance down.
  const next = readLicense(key)
  if (next.status === 'invalid' || !next.payload) {
    return NextResponse.json({ error: next.message }, { status: 400 })
  }
  if (next.status === 'expired') {
    return NextResponse.json(
      { error: 'That licence has already expired. Please ask support for a current one.' },
      { status: 400 },
    )
  }

  const current = await getLicenseState()

  // Stale-key guard: replaying an older key would be a way to move an install
  // back to a lower tier, or to undo a renewal. Time only moves forward here.
  if (current.payload && next.payload.iat < current.payload.iat) {
    return NextResponse.json(
      { error: 'That licence is older than the one already installed. Applying it would downgrade this installation.' },
      { status: 409 },
    )
  }

  // `preview` lets the UI show an old → new diff before committing.
  if (body.preview) {
    return NextResponse.json({
      preview: true,
      from: current.payload && {
        customer: current.payload.customer, tier: current.payload.tier,
        seats: current.payload.limits?.seats ?? null,
        expiresAt: new Date(current.payload.exp * 1000).toISOString(),
      },
      to: {
        customer: next.payload.customer, tier: next.payload.tier,
        seats: next.payload.limits?.seats ?? null,
        expiresAt: new Date(next.payload.exp * 1000).toISOString(),
      },
    })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('instance_settings').upsert({
    id: 1,
    license_key: key,
    license_customer: next.payload.customer,
    license_expires_at: new Date(next.payload.exp * 1000).toISOString(),
    license_applied_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateLicenseCache()

  await logAuditEvent({
    workspaceId: ctx.workspaceId,
    userId: ctx.user.id,
    actorEmail: ctx.user.email,
    category: 'workspace',
    action: 'license.applied',
    target: next.payload.customer,
    summary: `Applied licence for ${next.payload.customer} (${next.payload.tier}, expires ${new Date(next.payload.exp * 1000).toISOString().slice(0, 10)})`,
    metadata: { lid: next.payload.lid, tier: next.payload.tier },
  })

  return NextResponse.json({ ok: true, status: next.status, message: next.message })
}

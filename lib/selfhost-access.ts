import { createAdminClient } from '@/lib/supabase/admin'
import { compareVersions } from '@/lib/version'

// ============================================================
// Who may download a self-hosted build
// ============================================================
// A self-hosted customer still signs in to the cloud to fetch bundles — their
// own install may have no internet at all, and in the air-gapped case they are
// downloading on a completely different machine and walking it across on a USB
// stick. So entitlement is decided here, against the cloud user, not against
// anything on their server.
// ============================================================

export interface SelfhostAccess {
  customerId: string
  company: string
  tier: string
  seats: number | null
  licenseExpiresAt: string | null
  licenseId: string | null
}

export interface ReleaseRow {
  version: string
  blob_url: string
  size_bytes: number | null
  sha256: string
  changelog: string | null
  channel: string
  published_at: string
}

/**
 * Resolve the signed-in user to a self-hosted customer, or null.
 *
 * Matches on `user_id` first, then falls back to the contact email. The
 * fallback is what makes a sale work in the normal order of events: we create
 * the customer when they pay, and they create their cloud account afterwards,
 * so there is nothing to link at the time the row is written. On the first
 * successful email match the link is written back, so this costs one extra
 * query once per customer and never again.
 */
export async function getSelfhostAccess(
  userId: string,
  email: string | null | undefined,
): Promise<SelfhostAccess | null> {
  const admin = createAdminClient()

  const columns = 'id, company, tier, seats, status, downloads_enabled, license_expires_at, license_id, user_id'

  const { data: byId, error } = await admin
    .from('selfhost_customers')
    .select(columns)
    .eq('user_id', userId)
    .maybeSingle()

  // Before migration 056, or if the table is unreachable: no access, no crash.
  // The downloads page renders its "not entitled" state, which is correct.
  if (error) return null

  let row = byId

  if (!row && email) {
    const { data: byEmail } = await admin
      .from('selfhost_customers')
      .select(columns)
      .ilike('contact_email', email)
      .is('user_id', null)
      .maybeSingle()

    if (byEmail) {
      await admin.from('selfhost_customers').update({ user_id: userId }).eq('id', byEmail.id)
      row = byEmail
    }
  }

  if (!row) return null

  // Two independent switches, both of which must be on. `status` is the
  // commercial relationship; `downloads_enabled` is this specific privilege.
  // A customer mid-renewal keeps downloads while their licence is expired —
  // that is the case these being separate exists to serve.
  if (row.status !== 'active' || !row.downloads_enabled) return null

  return {
    customerId: row.id,
    company: row.company,
    tier: row.tier,
    seats: row.seats,
    licenseExpiresAt: row.license_expires_at,
    licenseId: row.license_id,
  }
}

/**
 * Published, un-yanked releases, newest version first.
 *
 * Ordered by parsed semver rather than `published_at`, because a patch to an
 * older line (1.9.1 shipped after 1.10.0) would otherwise present itself as
 * the newest build and get installed as an upgrade.
 */
export async function listReleases(includeBeta = false): Promise<ReleaseRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('selfhost_releases')
    .select('version, blob_url, size_bytes, sha256, changelog, channel, published_at')
    .eq('yanked', false)
    .order('published_at', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return (data as ReleaseRow[])
    .filter(r => includeBeta || r.channel === 'stable')
    .sort((a, b) => compareVersions(b.version, a.version))
}

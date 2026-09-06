import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { readLicense, type LicenseState } from '@/lib/license'

// ============================================================
// The installed licence, cached
// ============================================================
// getWorkspaceFeatures() runs on nearly every page, so re-reading and
// re-verifying the licence each time would put a database round trip and a
// signature check on every request. The key changes roughly never, so a short
// cache is free.
//
// Kept apart from lib/license.ts so that module stays pure and unit-testable
// with no database anywhere near it.
// ============================================================

const CACHE_MS = 60 * 60 * 1000   // 1 hour

let cached: { state: LicenseState; at: number } | null = null

/** Drop the cache — called after an admin applies or removes a key. */
export function invalidateLicenseCache(): void {
  cached = null
}

/**
 * The current licence state for this installation.
 *
 * Always 'absent' on cloud: plans there come from the workspace row, and a
 * licence has no meaning.
 */
export async function getLicenseState(): Promise<LicenseState> {
  if (!isSelfHost()) {
    return { status: 'absent', payload: null, daysRemaining: 0, message: '' }
  }

  if (cached && Date.now() - cached.at < CACHE_MS) return cached.state

  let key: string | null = null
  let revokedMessage: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('instance_settings')
      .select('license_key, checkin_status, checkin_message')
      .eq('id', 1)
      .maybeSingle()
    key = data?.license_key ?? null

    // ONLY an explicit 'revoked' counts. 'unreachable', and a null status from
    // a row written before migration 057, both mean we have not heard anything
    // — and not hearing anything must never change what this installation
    // grants, or unplugging the network cable would become a licensing event.
    if (data?.checkin_status === 'revoked') {
      revokedMessage = data.checkin_message
        || 'This licence has been withdrawn. Please contact OrbitAPI support.'
    }
  } catch {
    // Migration 054 not applied yet, or the DB is briefly unreachable. Treat
    // it as unlicensed rather than throwing: an instance that won't render
    // because it can't read a licence row is worse than one running at the
    // free-tier floor.
    key = null
  }

  // Verified here, not trusted from the row — a tampered database grants
  // nothing without the matching signature.
  const verified = readLicense(key)

  // Revocation is overlaid on top of a VALID licence, never used to resurrect
  // a broken one: if the signature does not check out the licence is already
  // worth nothing, and relabelling it "revoked" would only confuse the support
  // conversation. The payload is kept so the page can still say who it was for.
  const state = revokedMessage && (verified.status === 'valid' || verified.status === 'grace')
    ? { ...verified, status: 'revoked' as const, message: revokedMessage }
    : verified

  cached = { state, at: Date.now() }
  return state
}

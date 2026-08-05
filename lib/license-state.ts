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
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('instance_settings')
      .select('license_key')
      .eq('id', 1)
      .maybeSingle()
    key = data?.license_key ?? null
  } catch {
    // Migration 054 not applied yet, or the DB is briefly unreachable. Treat
    // it as unlicensed rather than throwing: an instance that won't render
    // because it can't read a licence row is worse than one running at the
    // free-tier floor.
    key = null
  }

  // Verified here, not trusted from the row — a tampered database grants
  // nothing without the matching signature.
  const state = readLicense(key)
  cached = { state, at: Date.now() }
  return state
}

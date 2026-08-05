import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'

// ============================================================
// First-run state
// ============================================================
// A freshly installed self-hosted instance has an empty database and no way
// to sign in: public signup is disabled on the auth service, and there is no
// administrator yet to invite anyone. So the very first visit has to land on
// a setup wizard instead of the login page.
//
// This is checked on essentially every request, so the answer is CACHED. It
// is also a one-way door — once an account exists, no amount of deleting
// users should reopen an unauthenticated "create an admin" form, because that
// would be a trivial takeover of a running instance. Hence `setupComplete`
// latches to true and is never cleared while the process lives.
// ============================================================

let setupComplete = false
let lastCheck = 0

/** Re-check at most this often while the instance is still unconfigured. */
const RECHECK_MS = 5_000

/**
 * Does this instance still need its first administrator?
 *
 * Always false on cloud, where accounts are created by public signup.
 * Never throws: if the database can't be reached we report "no setup needed",
 * because sending everyone to an open account-creation form on a DB blip
 * would be far worse than showing a login page that happens to fail.
 */
export async function needsFirstRunSetup(): Promise<boolean> {
  if (!isSelfHost()) return false
  if (setupComplete) return false

  const now = Date.now()
  if (now - lastCheck < RECHECK_MS) return !setupComplete
  lastCheck = now

  try {
    const admin = createAdminClient()
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    if (error) {
      // Could be a not-yet-migrated database on very first boot. Treat an
      // unreadable profiles table as "not set up" ONLY if the error says the
      // relation is missing; anything else is a fault, and faults must not
      // unlock the setup form.
      const missingTable = /relation .* does not exist|could not find the table/i.test(error.message)
      return missingTable
    }

    if ((count ?? 0) > 0) {
      setupComplete = true
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Called once the first admin exists, so the wizard closes immediately. */
export function markSetupComplete(): void {
  setupComplete = true
}

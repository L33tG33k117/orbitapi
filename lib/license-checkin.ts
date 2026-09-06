import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { getVersion } from '@/lib/version'

// ============================================================
// Calling home (self-hosted only, optional)
// ============================================================
// Asks the cloud whether this licence is still good and whether a newer
// version exists. Runs on the in-process scheduler, once a day.
//
// The original offline design was explicitly stateless with no phone-home, and
// that stance is preserved where it matters: this call is optional, the
// instance works identically without it, and an air-gapped box that can never
// reach us is a supported configuration rather than a degraded one.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: a failed check-in must never change
// what the installation grants. Losing internet is not a licensing event. Only
// an explicit, successful 'revoked' answer narrows anything, and even then the
// signed licence remains the authority for tier and expiry — this only adds a
// reason to stop, never a reason to start.
// ============================================================

/** Where to check in. Points at the cloud, overridable for testing. */
const CHECKIN_URL =
  process.env.ORBIT_CHECKIN_URL || 'https://orbitapi-eosin.vercel.app/api/selfhost/checkin'

const TIMEOUT_MS = 10_000

export interface CheckinResult {
  status: 'ok' | 'revoked' | 'unreachable' | 'disabled' | 'skipped'
  message: string
  latestVersion: string | null
}

/**
 * Run one check-in and record what came back.
 *
 * Never throws. A scheduler tick that dies on a network blip would take the
 * rest of the tick's work with it.
 */
export async function runLicenseCheckin(): Promise<CheckinResult> {
  const idle: CheckinResult = { status: 'skipped', message: '', latestVersion: null }
  if (!isSelfHost()) return idle

  const admin = createAdminClient()

  let row: {
    license_key: string | null
    checkin_enabled: boolean | null
    install_id: string | null
  } | null = null

  try {
    const { data } = await admin
      .from('instance_settings')
      .select('license_key, checkin_enabled, install_id')
      .eq('id', 1)
      .maybeSingle()
    row = data
  } catch {
    // Migration 057 not applied, or the DB is briefly unreachable. Nothing to
    // do, and nothing to change.
    return idle
  }

  if (!row?.license_key) return idle
  // Explicit opt-out. `!== false` rather than truthiness so a null column on a
  // row written before 057 still counts as enabled, matching the DB default.
  if (row.checkin_enabled === false) {
    return { status: 'disabled', message: '', latestVersion: null }
  }

  const version = getVersion().version

  let result: CheckinResult
  try {
    // AbortSignal.timeout so a black-holed connection cannot hang the tick
    // until the next one is due.
    const res = await fetch(CHECKIN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: row.license_key,
        version,
        installId: row.install_id,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      // A 4xx/5xx is still "we didn't get an answer". Notably a 401 (the cloud
      // could not verify the key) is NOT treated as revocation — that way a
      // signing-key rotation gone wrong cannot switch off every install in the
      // field at once.
      result = { status: 'unreachable', message: '', latestVersion: null }
    } else {
      const data = await res.json() as { status?: string; message?: string; latestVersion?: string | null }
      result = {
        status: data.status === 'revoked' ? 'revoked' : 'ok',
        message: typeof data.message === 'string' ? data.message : '',
        latestVersion: data.latestVersion ?? null,
      }
    }
  } catch {
    // Offline, DNS failure, timeout, TLS interception — all the same thing
    // from here, and all of them harmless.
    result = { status: 'unreachable', message: '', latestVersion: null }
  }

  try {
    await admin
      .from('instance_settings')
      .update({
        last_checkin_at: new Date().toISOString(),
        checkin_status: result.status,
        checkin_message: result.message || null,
        // Only overwrite on a real answer. An unreachable check-in must not
        // erase a version we already knew about.
        ...(result.latestVersion ? { latest_version: result.latestVersion } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
  } catch {
    // Recording the outcome is a convenience, not the point of the call.
  }

  return result
}

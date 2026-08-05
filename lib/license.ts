import { createPublicKey, verify as verifySignature } from 'node:crypto'
import type { WorkspaceTier } from '@/types'
import type { FeatureOverrides } from '@/lib/entitlements'

// ============================================================
// Licence keys
// ============================================================
// A self-hosted customer has no internet, so a licence cannot be checked
// against a server. It has to carry its own proof — an Ed25519 signature over
// the payload, verified against a public key embedded in the app.
//
// Format:  ORBIT.<base64url(payload)>.<base64url(signature)>
//
// Deliberately NOT a JWT: this is two base64 segments and one verify call,
// and a JWT library would bring `alg` negotiation with it — the source of the
// classic "alg: none" bypass. There is exactly one algorithm here and no way
// to ask for another.
//
// The payload feeds the EXISTING pure hasCapability() unchanged, so
// capabilityGuard, page-gate and the sidebar all keep working with no
// knowledge that licences exist.
//
// Copying a key between installs is possible and not worth preventing:
// offline validation fundamentally cannot detect it, and seat limits bound
// the damage. Don't over-engineer this.
// ============================================================

export interface LicensePayload {
  /** Licence id, for support to identify an install. */
  lid: string
  customer: string
  email?: string
  edition: 'selfhost'
  tier: WorkspaceTier
  /** Per-capability grants/revokes, same shape as workspaces.feature_flags. */
  overrides?: FeatureOverrides
  limits?: { seats?: number }
  /** Issued at / expires at, seconds since epoch. */
  iat: number
  exp: number
  /** Which signing key was used, so keys can be rotated. */
  kid: string
}

export type LicenseStatus = 'valid' | 'grace' | 'expired' | 'invalid' | 'absent'

export interface LicenseState {
  status: LicenseStatus
  payload: LicensePayload | null
  /** Whole days until expiry (negative once past it). */
  daysRemaining: number
  /** Plain-English reason, safe to show an admin. */
  message: string
}

/**
 * Public halves of the release signing keys, selected by `kid`.
 *
 * Adding a new entry rotates: existing licences keep verifying against their
 * old key while new ones are issued under the new one. The private halves live
 * in the founder's password manager and are never in this repo.
 */
const PUBLIC_KEYS: Record<string, string> = {
  k1: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAgy2Sx1U15eOpczGFL/hoarXLvKj7OFHOfleuWbT+BNc=
-----END PUBLIC KEY-----
`,
}

/** Capabilities still allowed once a licence has fully lapsed. */
export const EXPIRED_TIER: WorkspaceTier = 'free'

/** How long past `exp` the instance keeps working normally. */
export const GRACE_DAYS = 30

const PREFIX = 'ORBIT.'

function decodePayload(segment: string): LicensePayload | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8')
    const p = JSON.parse(json) as LicensePayload
    if (!p || typeof p !== 'object') return null
    if (!p.lid || !p.customer || !p.tier || !p.kid) return null
    if (typeof p.iat !== 'number' || typeof p.exp !== 'number') return null
    return p
  } catch {
    return null
  }
}

/**
 * Verify a licence key and describe what it currently entitles.
 *
 * Pure and synchronous — no DB, no network, no clock skew tolerance beyond the
 * grace period. Safe to call on every request; the caller caches anyway.
 */
export function readLicense(key: string | null | undefined, now: Date = new Date()): LicenseState {
  return readLicenseWith(key, PUBLIC_KEYS, now)
}

/**
 * The implementation, with the trusted key set passed in.
 *
 * Exported so tests can exercise the real verification path against a key pair
 * they generate. Deliberately NOT driven by an environment variable: on a
 * self-hosted box the customer controls the environment, so an env-supplied
 * trust anchor would let them mint their own licences.
 */
export function readLicenseWith(
  key: string | null | undefined,
  publicKeys: Record<string, string>,
  now: Date = new Date(),
): LicenseState {
  const absent: LicenseState = {
    status: 'absent', payload: null, daysRemaining: 0,
    message: 'No licence key has been applied to this installation.',
  }
  if (!key || !key.trim()) return absent

  const trimmed = key.trim()
  if (!trimmed.startsWith(PREFIX)) {
    return { status: 'invalid', payload: null, daysRemaining: 0, message: 'That does not look like an OrbitAPI licence key.' }
  }

  const [payloadB64, sigB64] = trimmed.slice(PREFIX.length).split('.')
  if (!payloadB64 || !sigB64) {
    return { status: 'invalid', payload: null, daysRemaining: 0, message: 'That licence key is incomplete.' }
  }

  const payload = decodePayload(payloadB64)
  if (!payload) {
    return { status: 'invalid', payload: null, daysRemaining: 0, message: 'That licence key could not be read.' }
  }

  const pem = publicKeys[payload.kid]
  if (!pem) {
    // Almost always an old installation meeting a newer signing key, which is
    // fixable by updating — say that rather than "invalid", which sounds like
    // the customer was sold a bad key.
    return {
      status: 'invalid', payload: null, daysRemaining: 0,
      message: 'This licence was signed with a key this version does not recognise. Update OrbitAPI, or contact support.',
    }
  }

  let signatureOk = false
  try {
    signatureOk = verifySignature(
      null,
      Buffer.from(payloadB64),
      createPublicKey(pem),
      Buffer.from(sigB64, 'base64url'),
    )
  } catch {
    signatureOk = false
  }
  if (!signatureOk) {
    return { status: 'invalid', payload: null, daysRemaining: 0, message: 'That licence key failed its signature check.' }
  }

  const nowSec = Math.floor(now.getTime() / 1000)
  const daysRemaining = Math.ceil((payload.exp - nowSec) / 86_400)

  if (nowSec <= payload.exp) {
    return { status: 'valid', payload, daysRemaining, message: `Licensed to ${payload.customer}.` }
  }

  const graceEnds = payload.exp + GRACE_DAYS * 86_400
  if (nowSec <= graceEnds) {
    const left = Math.ceil((graceEnds - nowSec) / 86_400)
    return {
      status: 'grace', payload, daysRemaining,
      message: `This licence expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago. Everything keeps working for another ${left} day${left === 1 ? '' : 's'}. Please renew.`,
    }
  }

  return {
    status: 'expired', payload, daysRemaining,
    message: 'This licence has expired. Your data is still here and can still be exported, but automation features are paused until it is renewed.',
  }
}

/**
 * What a licence state grants.
 *
 * Data access and export are NEVER withdrawn — an air-gapped customer whose
 * licence lapses must not be locked out of their own operational data. Only
 * the automation surface collapses.
 */
export function licenseEntitlements(state: LicenseState): { tier: WorkspaceTier; overrides: FeatureOverrides } {
  if ((state.status === 'valid' || state.status === 'grace') && state.payload) {
    return { tier: state.payload.tier, overrides: state.payload.overrides ?? {} }
  }
  // absent / invalid / expired all fall to the floor. Absent is included on
  // purpose: an unlicensed instance runs in a usable trial-shaped state rather
  // than refusing to start, so an install can be evaluated before a key exists.
  return { tier: EXPIRED_TIER, overrides: {} }
}

/** Should the UI show a renewal banner, and how loudly? */
export function licenseBanner(state: LicenseState): { tone: 'none' | 'info' | 'warn' | 'error'; text: string } {
  switch (state.status) {
    case 'valid':
      // Only start nagging in the last fortnight; earlier is noise.
      return state.daysRemaining <= 14
        ? { tone: 'info', text: `Your OrbitAPI licence expires in ${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'}.` }
        : { tone: 'none', text: '' }
    case 'grace':
      return { tone: 'warn', text: state.message }
    case 'expired':
      return { tone: 'error', text: state.message }
    case 'invalid':
      return { tone: 'error', text: state.message }
    case 'absent':
      return { tone: 'info', text: 'This installation is unlicensed. Apply a licence key to unlock automation features.' }
  }
}

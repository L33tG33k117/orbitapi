import { createPrivateKey, sign as signBuffer, randomUUID } from 'node:crypto'
import type { WorkspaceTier } from '@/types'
import type { LicensePayload } from '@/lib/license'
import { isSelfHost } from '@/lib/edition'

// ============================================================
// Minting licence keys
// ============================================================
// The counterpart to lib/license.ts, which only ever VERIFIES. This module
// signs, and it runs in exactly one place: the cloud admin section, behind
// requireSuperAdmin.
//
// NOTHING here may ever reach a client bundle: the private signing key mints
// unlimited enterprise licences for every install in the field. The
// `node:crypto` import is what enforces that — it cannot be bundled for the
// browser, so an accidental import from a 'use client' component fails the
// build rather than leaking. Keep it that way; do not soften it to a runtime
// check.
//
// It is also hard-refused on self-hosted builds. No signing code runs on
// hardware we do not control, full stop. (Verification is unaffected: it takes
// its trust anchor as an argument and lib/license.ts passes the embedded
// PUBLIC_KEYS, so a customer setting LICENSE_SIGNING_KEY on their own box
// achieves precisely nothing.)
// ============================================================

/** The signing key currently in use. Rotating means a new kid here AND a new
 *  public half in PUBLIC_KEYS in lib/license.ts — old licences keep verifying. */
export const ACTIVE_KID = 'k1'

/** Days of licence we grant per month sold. 30.44 = the mean Gregorian month,
 *  so a "12 month" licence lands on the same date next year rather than drifting
 *  five days early the way 30 would. */
const DAYS_PER_MONTH = 30.44

export interface IssueInput {
  customer: string
  email?: string
  tier: WorkspaceTier
  seats?: number
  months: number
}

export interface IssuedLicense {
  key: string
  payload: LicensePayload
}

export class SigningKeyMissingError extends Error {
  constructor() {
    super('LICENSE_SIGNING_KEY is not configured, so licences cannot be issued.')
    this.name = 'SigningKeyMissingError'
  }
}

/**
 * Read the private signing key from the environment.
 *
 * Accepts either a raw PEM (with real newlines, which Vercel's UI does
 * preserve) or a base64 blob of one. The base64 form exists because pasting a
 * multi-line secret into a CI variable or a shell export is where PEMs
 * historically get mangled into a single line and then fail with a message
 * that says nothing useful.
 */
function loadPrivateKey() {
  const raw = process.env.LICENSE_SIGNING_KEY?.trim()
  if (!raw) throw new SigningKeyMissingError()

  const pem = raw.includes('-----BEGIN')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8')

  if (!pem.includes('-----BEGIN')) {
    throw new Error('LICENSE_SIGNING_KEY is neither a PEM nor base64-encoded PEM.')
  }

  try {
    return createPrivateKey(pem)
  } catch {
    // Never echo the key or the underlying error — an OpenSSL parse failure can
    // quote fragments of the input back at you.
    throw new Error('LICENSE_SIGNING_KEY could not be parsed as a private key.')
  }
}

/** Is issuing possible right now? Lets the UI say so before showing a form. */
export function canIssueLicenses(): boolean {
  if (isSelfHost()) return false
  try {
    loadPrivateKey()
    return true
  } catch {
    return false
  }
}

/**
 * Mint and sign a licence key.
 *
 * The signed material is the base64url payload segment exactly as it appears
 * in the final key — not the JSON, not a re-serialisation of it. Signing the
 * encoded form is what makes the "swap the payload, keep the signature" attack
 * impossible to dress up: there is no re-encoding step in verification where a
 * different-but-equivalent JSON could sneak through.
 */
export function issueLicense(input: IssueInput, now: Date = new Date()): IssuedLicense {
  if (isSelfHost()) {
    throw new Error('Licences cannot be issued from a self-hosted installation.')
  }

  const { customer, email, tier, seats, months } = input

  if (!customer?.trim()) throw new Error('A customer name is required.')
  if (!Number.isFinite(months) || months <= 0) throw new Error('Term must be a positive number of months.')
  if (seats !== undefined && (!Number.isInteger(seats) || seats <= 0)) {
    throw new Error('Seats must be a whole number greater than zero.')
  }

  const privateKey = loadPrivateKey()

  const iat = Math.floor(now.getTime() / 1000)
  const exp = iat + Math.round(months * DAYS_PER_MONTH * 86_400)

  const payload: LicensePayload = {
    lid: randomUUID(),
    customer: customer.trim(),
    ...(email?.trim() ? { email: email.trim() } : {}),
    edition: 'selfhost',
    tier,
    ...(seats ? { limits: { seats } } : {}),
    iat,
    exp,
    kid: ACTIVE_KID,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = signBuffer(null, Buffer.from(payloadB64), privateKey).toString('base64url')

  return { key: `ORBIT.${payloadB64}.${sig}`, payload }
}

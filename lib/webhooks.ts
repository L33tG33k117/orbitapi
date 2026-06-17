import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// ============================================================
// Foundation D — Webhook signing helpers
// ============================================================
// HMAC-SHA256 over the raw request body. Senders compute:
//   signature = hex( HMAC_SHA256(signing_secret, rawBody) )
// and send it as:  X-Orbit-Signature: sha256=<hex>
// We verify with a constant-time compare to avoid timing attacks.
// ============================================================

export const SIGNATURE_HEADER = 'x-orbit-signature'

export function generateToken(): string {
  // URL-safe, unguessable path segment.
  return randomBytes(24).toString('base64url')
}

export function generateSigningSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`
}

export function sign(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
}

// Constant-time verification. Returns false on any malformed input rather
// than throwing, so callers can branch cleanly.
export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false
  const expected = sign(secret, rawBody)
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

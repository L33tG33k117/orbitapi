import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

interface ConnectionRow {
  id: string
  vault_secret_id: string | null
}

const INLINE_PREFIX = 'inline:'
const ENC_PREFIX = 'enc:v1:'

// ============================================================
// Secret storage
// ============================================================
// Three formats, chosen at write time and self-describing at read time:
//
//   Supabase Vault   the hosted product. The stored value is a vault secret id.
//   `enc:v1:…`       AES-256-GCM, key from ORBIT_SECRETS_KEY. Used by the
//                    self-hosted edition, which has no Vault.
//   `inline:<b64>`   LEGACY. Base64 only — NOT encryption. It exists because
//                    early rows were written this way when Vault wasn't
//                    enabled. Still readable so those rows keep working; never
//                    written any more when a key is configured.
//
// Every caller goes through storeSecret/readSecret rather than hand-rolling
// the encoding, so the format can change in exactly one place.
//
// ORBIT_SECRETS_KEY is 32 bytes, base64 or hex. LOSING IT MEANS LOSING EVERY
// STORED CREDENTIAL — there is no recovery path, by design. The installer
// generates it and the docs tell the operator to back it up.
// ============================================================

function secretsKey(): Buffer | null {
  const raw = process.env.ORBIT_SECRETS_KEY
  if (!raw) return null
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    console.error('[credentials] ORBIT_SECRETS_KEY must decode to exactly 32 bytes — ignoring it')
    return null
  }
  return buf
}

function encrypt(payload: Record<string, unknown>, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`
}

function decrypt(stored: string, key: Buffer): Record<string, string> | null {
  const [ivB64, ctB64, tagB64] = stored.slice(ENC_PREFIX.length).split(':')
  if (!ivB64 || !ctB64 || !tagB64) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
    return JSON.parse(pt.toString('utf8'))
  } catch {
    // Wrong key or tampered ciphertext. Both mean "we cannot honour this
    // secret", and neither should leak which one it was.
    return null
  }
}

/**
 * Persist a secret payload and return the id to store on the owning row.
 *
 * Order of preference: Vault (hosted) → AES-GCM (self-hosted) → inline base64
 * (last resort, dev only, logs a warning because it is not encryption).
 */
export async function storeSecret(
  payload: Record<string, unknown>,
  name: string,
): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('vault.create_secret', {
      secret: JSON.stringify(payload),
      name,
    })
    if (!error && data) return data as string
  } catch {
    /* fall through to local encryption */
  }

  const key = secretsKey()
  if (key) return encrypt(payload, key)

  console.warn(
    '[credentials] Vault unavailable and ORBIT_SECRETS_KEY is not set — ' +
    'storing this secret base64-encoded, which is NOT encryption. Set ORBIT_SECRETS_KEY.',
  )
  return `${INLINE_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64')}`
}

/**
 * Read a secret back. Returns null if it can't be resolved — callers decide
 * whether that's fatal, and none of them should crash on a missing secret.
 */
export async function readSecret(
  secretId: string | null | undefined,
): Promise<Record<string, string> | null> {
  if (!secretId) return null

  if (secretId.startsWith(ENC_PREFIX)) {
    const key = secretsKey()
    if (!key) {
      console.error('[credentials] found an encrypted secret but ORBIT_SECRETS_KEY is not set')
      return null
    }
    return decrypt(secretId, key)
  }

  if (secretId.startsWith(INLINE_PREFIX)) {
    try {
      const json = Buffer.from(secretId.slice(INLINE_PREFIX.length), 'base64').toString('utf8')
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  // Supabase Vault — use the public wrapper RPC (vault.decrypted_secrets is a view,
  // not a function, so it cannot be called via rpc() directly)
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('get_vault_secret', { secret_id: secretId })
    if (error || !data) return null
    return JSON.parse(data as string)
  } catch {
    return null
  }
}

/** Is this stored secret in the legacy, unencrypted base64 format? */
export function isLegacyInlineSecret(secretId: string | null | undefined): boolean {
  return !!secretId && secretId.startsWith(INLINE_PREFIX)
}

/** Re-encrypt a legacy inline secret with the configured key. Null if not applicable. */
export function reencryptLegacySecret(secretId: string): string | null {
  const key = secretsKey()
  if (!key || !secretId.startsWith(INLINE_PREFIX)) return null
  try {
    const json = Buffer.from(secretId.slice(INLINE_PREFIX.length), 'base64').toString('utf8')
    return encrypt(JSON.parse(json), key)
  } catch {
    return null
  }
}

// Resolves credentials for a connection. Returns a flat key-value map
// that is passed to connector action execute() functions.
// Also injects connection_id so connectors that use DB state (e.g. Simulated Lights) can scope queries.
export async function resolveCredentials(
  connection: ConnectionRow
): Promise<Record<string, string>> {
  const base: Record<string, string> = { connection_id: connection.id }
  const secret = await readSecret(connection.vault_secret_id)
  return secret ? { ...base, ...secret } : base
}

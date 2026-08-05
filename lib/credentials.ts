import { createAdminClient } from '@/lib/supabase/admin'

interface ConnectionRow {
  id: string
  vault_secret_id: string | null
}

const INLINE_PREFIX = 'inline:'

// ============================================================
// Secret storage
// ============================================================
// Two backends, chosen at write time and self-describing at read time:
//
//   Supabase Vault  — the real one. The stored value is a vault secret id.
//   `inline:<b64>`  — fallback for when Vault isn't enabled (local dev, and
//                     the self-hosted edition, which has no Vault).
//
// Every caller goes through storeSecret/readSecret rather than hand-rolling
// the base64 dance, so the self-hosted edition can later swap the inline
// branch for real AES-256-GCM encryption in exactly one place.
// ============================================================

/**
 * Persist a secret payload and return the id to store on the owning row.
 * Prefers Vault; falls back to inline encoding if Vault is unavailable.
 */
export async function storeSecret(
  payload: Record<string, unknown>,
  name: string,
): Promise<string> {
  const inline = () => `${INLINE_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64')}`
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('vault.create_secret', {
      secret: JSON.stringify(payload),
      name,
    })
    if (error || !data) {
      console.warn('Vault not available, falling back to inline storage:', error?.message)
      return inline()
    }
    return data as string
  } catch {
    return inline()
  }
}

/**
 * Read a secret back. Returns null if it can't be resolved — callers decide
 * whether that's fatal, and none of them should crash on a missing secret.
 */
export async function readSecret(
  secretId: string | null | undefined,
): Promise<Record<string, string> | null> {
  if (!secretId) return null

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

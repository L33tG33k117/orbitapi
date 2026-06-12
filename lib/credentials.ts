import { createAdminClient } from '@/lib/supabase/admin'

interface ConnectionRow {
  id: string
  vault_secret_id: string | null
}

// Resolves credentials for a connection. Returns a flat key-value map
// that is passed to connector action execute() functions.
// Also injects connection_id so connectors that use DB state (e.g. Simulated Lights) can scope queries.
export async function resolveCredentials(
  connection: ConnectionRow
): Promise<Record<string, string>> {
  const base: Record<string, string> = { connection_id: connection.id }
  const secretId = connection.vault_secret_id

  if (!secretId) return base

  // Inline fallback (used when Vault is unavailable)
  if (secretId.startsWith('inline:')) {
    try {
      const json = Buffer.from(secretId.slice(7), 'base64').toString('utf8')
      return { ...base, ...JSON.parse(json) }
    } catch {
      return base
    }
  }

  // Supabase Vault
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('vault.decrypted_secrets', { secret_id: secretId })
    if (error || !data) return base
    return { ...base, ...JSON.parse(data) }
  } catch {
    return base
  }
}

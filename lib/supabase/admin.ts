import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUrl } from '@/lib/runtime-config'

// Service-role client — bypasses RLS. Never expose to the browser.
// Always verify the caller's identity with the regular client first,
// then use this only for writes that require elevated access.
//
// serverSupabaseUrl() prefers SUPABASE_INTERNAL_URL so the self-hosted app
// container talks to its PostgREST sibling directly over the compose network,
// rather than looping back out through the public gateway.
export function createAdminClient() {
  return createClient(
    serverSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

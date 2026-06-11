import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Never expose to the browser.
// Always verify the caller's identity with the regular client first,
// then use this only for writes that require elevated access.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

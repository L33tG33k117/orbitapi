import { createBrowserClient } from '@supabase/ssr'
import { browserSupabaseAnonKey, browserSupabaseUrl } from '@/lib/runtime-config'

// URL and key come from lib/runtime-config rather than straight from env: the
// self-hosted image is built once and run by every customer at their own
// address with their own generated keys, so neither value can be inlined at
// build time. On cloud these resolve to exactly the NEXT_PUBLIC_ values they
// always did.
export function createClient() {
  return createBrowserClient(browserSupabaseUrl(), browserSupabaseAnonKey())
}

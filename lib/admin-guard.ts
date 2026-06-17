import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Returns the authenticated user if they have super_admin = true, otherwise null. */
export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('super_admin')
    .eq('id', user.id)
    .single()

  return profile?.super_admin ? user : null
}

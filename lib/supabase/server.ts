import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverSupabaseUrl } from '@/lib/runtime-config'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    serverSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

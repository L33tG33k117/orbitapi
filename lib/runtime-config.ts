// ============================================================
// Runtime config that the BROWSER needs
// ============================================================
// `NEXT_PUBLIC_*` values are inlined into the JS bundle when it is built. The
// self-hosted package ships ONE prebuilt image to every customer, and each
// instance has its OWN generated keys and its own address — so there is
// nothing correct to inline at build time.
//
// The server therefore serializes these values into the HTML at request time
// (see RuntimeConfigScript in app/layout.tsx) and browser code reads them from
// there, falling back to the build-time env so cloud is completely unaffected.
//
// Keep this OBJECT SMALL and PUBLIC-SAFE: everything in it is visible in page
// source. The anon key belongs here (it's public by design and RLS-guarded);
// the service-role key never does.
// ============================================================

export interface BrowserRuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  edition: 'cloud' | 'selfhost'
}

export const RUNTIME_CONFIG_GLOBAL = '__ORBIT_RUNTIME_CONFIG__'

declare global {
  interface Window {
    [RUNTIME_CONFIG_GLOBAL]?: Partial<BrowserRuntimeConfig>
  }
}

/**
 * Where the browser should reach Supabase (PostgREST + GoTrue).
 *
 * On self-host the gateway serves `/rest/v1` and `/auth/v1` on the same origin
 * as the app, so the browser can simply use its own origin — which means the
 * image works at whatever hostname the customer puts it behind, with no
 * rebuild and nothing to configure.
 */
export function browserSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const injected = window[RUNTIME_CONFIG_GLOBAL]?.supabaseUrl
    if (injected) return injected
  }
  const baked = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (baked) return baked
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function browserSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const injected = window[RUNTIME_CONFIG_GLOBAL]?.supabaseAnonKey
    if (injected) return injected
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
}

/**
 * Where SERVER code should reach Supabase.
 *
 * Inside compose the app talks to the `orbit-rest` / `orbit-auth` containers
 * directly, which is both faster and immune to the gateway's TLS setup, so it
 * uses an internal address that differs from the public one.
 */
export function serverSupabaseUrl(): string {
  return process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

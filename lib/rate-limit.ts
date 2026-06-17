import { createAdminClient } from '@/lib/supabase/admin'

// Fixed-window rate limiter backed by Postgres (works across serverless
// instances, unlike an in-memory map). Returns true if the call is allowed.
// Fails open (returns true) on any DB error — throttling must never take the
// app down. Spend is separately capped by AI Power credits.
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}

// ============================================================
// The app's own public URL
// ============================================================
// Orbit needs to write absolute links to itself: email bodies, Stripe return
// URLs, auth redirects, OpenGraph metadata.
//
// On cloud that's a fixed value baked in at build time (`NEXT_PUBLIC_APP_URL`).
// That doesn't survive the move to a self-hosted package, because a
// `NEXT_PUBLIC_` variable is inlined into the bundle when the image is BUILT —
// and we ship ONE image that every customer runs at their own address. Baking
// in a URL would mean a per-customer build.
//
// So `ORBIT_APP_URL` is read at RUNTIME and wins when present. Cloud sets
// nothing new and keeps its existing behaviour exactly.
//
// Server-only: a runtime env var isn't visible to client components. Anything
// on the client gets the URL through config-provider instead.
// ============================================================

/**
 * Absolute base URL of this deployment, no trailing slash.
 *
 * @param fallback used when nothing is configured — pass the current request's
 *        origin where you have one, so a misconfigured instance still produces
 *        working links instead of pointing at localhost.
 */
export function getAppUrl(fallback?: string): string {
  const configured =
    process.env.ORBIT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    fallback ||
    'http://localhost:3000'
  return configured.replace(/\/+$/, '')
}

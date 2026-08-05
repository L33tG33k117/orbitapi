// ============================================================
// What version is this?
// ============================================================
// Cloud deploys continuously and version numbers mean little there — the
// answer people want is "which commit". A self-hosted install is the
// opposite: it sits at one version for months, and every support conversation
// starts with which one.
//
// ORBIT_VERSION is set as a build arg when the release image is built. Outside
// that, we fall back to the commit SHA the platform exposes.

export interface VersionInfo {
  /** Semantic version for a release build, or a short SHA, or 'dev'. */
  version: string
  /** True when this is a tagged self-hosted release rather than a rolling build. */
  released: boolean
}

export function getVersion(): VersionInfo {
  const v = process.env.ORBIT_VERSION
  if (v && /^\d+\.\d+\.\d+/.test(v)) return { version: v, released: true }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  if (sha) return { version: sha.slice(0, 7), released: false }

  return { version: v || 'dev', released: false }
}

/** Compare two semver strings. Returns -1, 0 or 1. Pre-release tags ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (s: string) => s.split('-')[0].split('.').map(n => parseInt(n, 10) || 0)
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) > (y[i] ?? 0)) return 1
    if ((x[i] ?? 0) < (y[i] ?? 0)) return -1
  }
  return 0
}

/** Is `candidate` newer than what's installed? */
export function isUpgrade(installed: string, candidate: string): boolean {
  if (!/^\d+\.\d+\.\d+/.test(installed)) return true   // dev build: anything tagged is newer
  return compareVersions(candidate, installed) > 0
}

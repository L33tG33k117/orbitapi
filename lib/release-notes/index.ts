import notes from '@/data/release-notes.json'

// ============================================================
// Release notes — two audiences, one timeline
// ============================================================
// ADMIN (generated): every change that landed on main, from git history via
//   npm run notes:build. Nobody has to remember to write it, so it cannot
//   silently fall behind what is deployed.
//
// CUSTOMER (curated): written by a human in lib/release-notes/customer.ts.
//   A commit subject is not release copy, and most commits are not worth a
//   customer's attention at all.
//
// The admin view reports the gap between the two, so "we shipped things and
// never told anyone" is visible rather than discovered months later.
// ============================================================

export interface ReleaseFileStat { path: string; added: number; removed: number; binary: boolean }

export interface ReleaseEntry {
  sha: string
  short: string
  /** ISO 8601 with offset, as the commit was authored. */
  date: string
  author: string
  subject: string
  category: 'security' | 'fix' | 'feature' | 'perf' | 'infra' | 'other'
  categoryLabel: string
  /** The commit body as prose paragraphs — the "why", which the subject omits. */
  paragraphs: string[]
  areas: string[]
  /** Migration filenames added by this change; these need applying to a database. */
  migrations: string[]
  files: number
  added: number
  removed: number
  topPaths: string[]
}

export interface ReleaseFeed {
  generatedAt: string
  generatedFrom: string | null
  since: string
  entries: ReleaseEntry[]
}

const feed = notes as unknown as ReleaseFeed

export function getReleaseFeed(): ReleaseFeed {
  return feed
}

/** Newest first, optionally filtered by category. */
export function getReleases(category?: string): ReleaseEntry[] {
  if (!category || category === 'all') return feed.entries
  return feed.entries.filter(e => e.category === category)
}

export function getRelease(sha: string): ReleaseEntry | undefined {
  return feed.entries.find(e => e.sha === sha || e.short === sha)
}

/** Every migration that has shipped, newest first — what a self-hosted admin must apply. */
export function shippedMigrations(): { file: string; sha: string; short: string; date: string }[] {
  return feed.entries.flatMap(e =>
    e.migrations.map(file => ({ file, sha: e.sha, short: e.short, date: e.date })),
  )
}

export interface ReleaseCounts { total: number; security: number; fix: number; feature: number; perf: number; infra: number; other: number }

export function countsSince(days: number): ReleaseCounts {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const recent = feed.entries.filter(e => new Date(e.date).getTime() >= cutoff)
  const counts: ReleaseCounts = { total: recent.length, security: 0, fix: 0, feature: 0, perf: 0, infra: 0, other: 0 }
  for (const e of recent) counts[e.category]++
  return counts
}

/**
 * The commit this deployment was built from, when the platform tells us.
 * Lets the admin view say "notes are current with what's running" instead of
 * leaving someone to compare hashes by eye.
 */
export function deployedSha(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.ORBIT_COMMIT_SHA ?? null
}

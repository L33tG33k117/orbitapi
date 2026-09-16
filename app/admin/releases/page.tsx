import { getReleaseFeed, countsSince, deployedSha, shippedMigrations } from '@/lib/release-notes'
import { CHANGELOG } from '@/lib/release-notes/customer'
import { ReleasesClient } from './releases-client'

export const dynamic = 'force-dynamic'

// Admin release notes: everything that landed on main, generated from git.
// The customer-facing version is /whats-new; this one exists so somebody with
// backend access can answer "what actually changed, and does anything need
// applying?" without reading the repository.
export default function AdminReleasesPage() {
  const feed = getReleaseFeed()
  const deployed = deployedSha()
  const migrations = shippedMigrations()

  // How far behind the customer-facing notes are. Shipping without telling
  // anyone is the failure this page is meant to make visible.
  const newestCurated = CHANGELOG[0]?.date ?? null
  const unannounced = newestCurated
    ? feed.entries.filter(e => e.date.slice(0, 10) > newestCurated).length
    : feed.entries.length

  return (
    <ReleasesClient
      entries={feed.entries}
      generatedAt={feed.generatedAt}
      generatedFrom={feed.generatedFrom}
      deployedSha={deployed}
      last30={countsSince(30)}
      last7={countsSince(7)}
      migrationCount={migrations.length}
      newestCuratedDate={newestCurated}
      unannouncedCount={unannounced}
    />
  )
}

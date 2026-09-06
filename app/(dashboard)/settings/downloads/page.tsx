import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { isSelfHost } from '@/lib/edition'
import { getSelfhostAccess, listReleases } from '@/lib/selfhost-access'
import { DownloadsClient } from './downloads-client'

export const dynamic = 'force-dynamic'

/**
 * Everything a self-hosted customer needs to serve themselves: their licence
 * key, their builds, and a way to ask for a renewal.
 *
 * docs/SELF_HOST.md has told customers to "sign in to your OrbitAPI account and
 * download the update bundle" since the offline edition shipped — this is the
 * page that sentence was describing. Until it existed, the only route to a
 * bundle was us emailing a tarball, and the only route to a mislaid licence key
 * was a support ticket.
 *
 * Cloud-only, deliberately: the whole point is that it is reachable from a
 * machine with internet, which the customer's server may well not be.
 */
export default async function DownloadsPage() {
  if (isSelfHost()) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getSelfhostAccess(user.id, user.email)
  // Not a self-hosted customer: this page has nothing to say to them, and
  // bouncing is kinder than an empty "you have no downloads" wall.
  if (!access) redirect('/dashboard')

  const releases = await listReleases()

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Your self-hosted installation"
        description="Your licence key, your installers, and everything you need to keep them current."
      />
      <DownloadsClient
        company={access.company}
        tier={access.tier}
        seats={access.seats}
        licenseExpiresAt={access.licenseExpiresAt}
        renewalRequestedAt={access.renewalRequestedAt}
        lastCheckinAt={access.lastCheckinAt}
        lastSeenVersion={access.lastSeenVersion}
        releases={releases.map(r => ({
          version: r.version,
          sizeBytes: r.size_bytes,
          sha256: r.sha256,
          changelog: r.changelog,
          publishedAt: r.published_at,
        }))}
      />
    </div>
  )
}

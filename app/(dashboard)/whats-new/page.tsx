import { CHANGELOG } from '@/lib/release-notes/customer'
import { PageHeader } from '@/components/page-header'
import { WhatsNewClient } from './whats-new-client'

export const metadata = { title: "What's new · OrbitAPI" }

// Customer-facing release notes. Deliberately the curated list, not the
// generated one: most of what we ship (a CI tweak, a refactor) is noise to
// someone using the product. Admins get the full technical feed at
// /admin/releases.
export default function WhatsNewPage() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Product"
        title="What's new"
        description="Everything we've shipped, newest first. We release often, so this is the short version of what changed and why it matters."
      />
      <WhatsNewClient entries={CHANGELOG} />
    </div>
  )
}

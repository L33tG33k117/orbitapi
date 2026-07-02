import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pageGate } from '@/components/page-gate'
import { DiscoverClient } from './discover-client'
import { PageHeader } from '@/components/page-header'
import { AdminsOnly } from '@/components/admins-only'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('discover'); if (gate) return gate
  if (membership.role === 'member') {
    return (
      <AdminsOnly
        workspaceId={membership.workspace_id}
        eyebrow="Connect"
        title="Discover a connector"
        description="This is where admins name any app (or paste its API documentation link) and Orbit maps out what it can do and builds a connector for it."
      />
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Connect"
        title="Discover a connector"
        description="Name any app (or paste its API documentation link) and Orbit will map out what it can do and propose a ready-to-build connector for it."
      />
      <DiscoverClient />
    </div>
  )
}

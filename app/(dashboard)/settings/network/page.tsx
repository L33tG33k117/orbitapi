import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { allConnectorNetworks } from '@/lib/network-access'
import { NetworkClient } from './network-client'

export const dynamic = 'force-dynamic'

// "What does OrbitAPI need to reach?" — the page a customer's security team
// asks for before they will open anything. Useful on cloud too (some hosted
// customers restrict egress from their own side), so it isn't edition-gated.
export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')
  if (membership.role === 'member') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('connections')
    .select('is_simulated, connector:connectors(slug)')
    .eq('workspace_id', membership.workspace_id)
    .neq('status', 'trashed')

  const connectedSlugs = [...new Set(
    (conns ?? [])
      .filter(c => !c.is_simulated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(c => (c.connector as any)?.slug)
      .filter(Boolean) as string[],
  )]

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Settings"
        title="Outbound network access"
        description="The exact addresses OrbitAPI needs to reach, so your firewall can allow them."
      />
      <NetworkClient
        connectors={allConnectorNetworks().filter(c => !c.simulated)}
        connectedSlugs={connectedSlugs}
      />
    </div>
  )
}

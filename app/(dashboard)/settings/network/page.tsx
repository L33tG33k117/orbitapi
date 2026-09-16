import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { allConnectorNetworks } from '@/lib/network-access'
import { NetworkClient } from './network-client'
import { isSelfHost } from '@/lib/edition'
import { getSelfhostAccess } from '@/lib/selfhost-access'

export const dynamic = 'force-dynamic'

// "What does OrbitAPI need to reach?" — the page a customer's security team
// asks for before they will open anything on their self-hosted install.
// On cloud we run the infrastructure, so this is shown only to accounts that
// hold a self-hosted licence (founder decision, 2026-09-15).
export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')
  if (membership.role === 'member') redirect('/dashboard')
  if (!isSelfHost() && !(await getSelfhostAccess(user!.id, user!.email))) redirect('/dashboard')

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
        title="Network access"
        description="The exact addresses OrbitAPI needs to reach, so your firewall can allow them."
      />
      {/* Direction matters: this page lists OUTBOUND rules (install → apps).
          Inbound is short and separate, so security teams don't confuse the two. */}
      <section className="rounded-xl border bg-card p-4 space-y-2 text-sm">
        <h2 className="font-medium">Which direction is which?</h2>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Outbound (the list below):</span> your OrbitAPI install
          connects out to each app&apos;s API. Allow these hosts from the OrbitAPI server on HTTPS (443).
          Nothing needs to be opened inward for this.
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Inbound (only if you use them):</span> people&apos;s browsers
          reach the OrbitAPI web UI, and apps that send webhooks or MCP clients reach
          <code className="mx-1 text-xs">/api/hooks/…</code> and <code className="mx-1 text-xs">/api/mcp/…</code>
          on your install. If nothing outside your network sends webhooks, keep inbound closed to the internet.
        </p>
      </section>

      <NetworkClient
        connectors={allConnectorNetworks().filter(c => !c.simulated)}
        connectedSlugs={connectedSlugs}
      />
    </div>
  )
}

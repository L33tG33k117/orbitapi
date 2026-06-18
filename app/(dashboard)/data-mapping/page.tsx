import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { pageGate } from '@/components/page-gate'
import { SectionIntro } from '@/components/section-intro'
import { DataMappingClient } from './data-mapping-client'

export default async function DataMappingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('data_mapping'); if (gate) return gate
  if (membership.role === 'member') {
    return <div className="p-8 max-w-3xl"><h1 className="text-2xl font-bold">Data mapping</h1><p className="text-muted-foreground mt-2">Admins only.</p></div>
  }

  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('connections')
    .select('id, label, connector:connectors(slug, name)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')

  const connections = (conns ?? []).map(c => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slug = (c.connector as any)?.slug
    const manifest = getConnector(slug)
    return {
      id: c.id, label: c.label,
      reads: (manifest?.actions ?? []).filter(a => a.risk === 'read').map(a => ({ slug: a.slug, name: a.name })),
      writes: (manifest?.actions ?? []).filter(a => a.risk !== 'read').map(a => ({ slug: a.slug, name: a.name })),
    }
  })

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Data mapping</h1>
        <p className="text-muted-foreground mt-1">
          Sync data between API connectors — e.g. Zendesk tickets → ServiceNow incidents. Orbit proposes the field
          mappings, previews the transformed record against a live sample, and you approve before automating.
        </p>
      </div>

      <SectionIntro id="data-mapping" />
      <DataMappingClient connections={connections} />
    </div>
  )
}

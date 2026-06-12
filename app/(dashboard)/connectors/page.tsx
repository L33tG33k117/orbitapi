import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { connectors } from '@/connectors'
import { toSummary } from '@/connectors/types'
import { ConnectorCard } from './connector-card'
import { ConnectionList } from './connection-list'

export default async function ConnectorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user!.id)
    .single()

  const admin = createAdminClient()
  const { data: connections } = await admin
    .from('connections')
    .select('*, connector:connectors(slug, name, category, is_simulated)')
    .eq('workspace_id', membership?.workspace_id)
    .order('created_at')

  const canManage = membership?.role !== 'member'

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Connectors</h1>
        <p className="text-muted-foreground mt-1">Connect your APIs and smart devices</p>
      </div>

      {(connections ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your connections</h2>
          <ConnectionList connections={connections ?? []} canManage={canManage} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Available connectors</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map(c => (
            <ConnectorCard key={c.slug} connector={toSummary(c)} canManage={canManage} />
          ))}
        </div>
      </section>
    </div>
  )
}

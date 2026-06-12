import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { Badge } from '@/components/ui/badge'
import { ActionDebugPanel } from './action-debug-panel'
import { SimulatedLightsPanel } from './simulated-lights-panel'

export default async function ConnectionPage({ params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user!.id)
    .single()

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('connections')
    .select('*, connector:connectors(slug, name, category, is_simulated)')
    .eq('id', connectionId)
    .single()

  if (!connection) notFound()
  if (connection.workspace_id !== membership?.workspace_id) redirect('/connectors')

  const connector = connection.connector as { slug: string; name: string; category: string; is_simulated: boolean }
  const manifest = getConnector(connector.slug)
  if (!manifest) notFound()

  const creds = await resolveCredentials(connection)

  // For the debug panel: run list actions to show live data
  let debugData: { slug: string; name: string; result: unknown }[] = []
  const readActions = manifest.actions.filter(a => a.risk === 'read')
  for (const action of readActions.slice(0, 2)) {
    try {
      const result = await action.execute(creds, {})
      debugData.push({ slug: action.slug, name: action.name, result: result.data ?? result })
    } catch (e) {
      debugData.push({ slug: action.slug, name: action.name, result: { error: String(e) } })
    }
  }

  // For simulated lights: fetch device state
  let devices: unknown[] = []
  if (connector.slug === 'simulated-lights') {
    const { data } = await admin
      .from('simulated_devices')
      .select('*')
      .eq('connection_id', connectionId)
    devices = data ?? []
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{connection.label}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {connector.name} · {connector.category}
          </p>
        </div>
        {connector.is_simulated && <Badge variant="secondary">Simulated</Badge>}
        <Badge variant={connection.status === 'active' ? 'default' : 'destructive'} className="ml-auto">
          {connection.status}
        </Badge>
      </div>

      {connector.slug === 'simulated-lights' && (
        <SimulatedLightsPanel connectionId={connectionId} initialDevices={devices as never[]} />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Live data</h2>
        <p className="text-xs text-muted-foreground">
          Read-only actions run server-side on page load. This is your connection working.
        </p>
        <ActionDebugPanel data={debugData} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Available actions</h2>
        <div className="border rounded-lg divide-y">
          {manifest.actions.map(a => (
            <div key={a.slug} className="px-4 py-3 flex items-start gap-3">
              <Badge
                variant={a.risk === 'read' ? 'outline' : a.risk === 'write' ? 'secondary' : 'destructive'}
                className="text-xs mt-0.5 shrink-0"
              >
                {a.risk}
              </Badge>
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{a.slug}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

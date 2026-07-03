import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { CONNECTOR_EXAMPLES } from '@/lib/connector-examples'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import Link from 'next/link'
import { ActionDebugPanel } from './action-debug-panel'
import { ActionsList } from './actions-list'
import { AccessControls } from './access-controls'
import { SimulatedLightsPanel } from './simulated-lights-panel'
import { GrantsPanel } from './grants-panel'
import { EditCredentialsPanel } from './edit-credentials-panel'
import { ReportIssuePanel } from './report-issue-panel'
import { WidgetBoard } from './widget-board'
import { ConvertToRealPanel } from './convert-to-real-panel'

export default async function ConnectionPage({ params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user!.id)
    .single()

  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin'

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
  // Skip for simulated connections — use simulation engine directly
  let debugData: { slug: string; name: string; result: unknown }[] = []
  const readActions = manifest.actions.filter(a => a.risk === 'read')

  if (connection.is_simulated) {
    const { simulateAction } = await import('@/lib/simulate-action')
    for (const action of readActions.slice(0, 2)) {
      const result = simulateAction(connector.slug, action.slug, {})
      debugData.push({ slug: action.slug, name: action.name, result: result.data ?? result })
    }
  } else {
    for (const action of readActions.slice(0, 2)) {
      try {
        const result = await action.execute(creds, {})
        debugData.push({ slug: action.slug, name: action.name, result: result.data ?? result })
      } catch (e) {
        debugData.push({ slug: action.slug, name: action.name, result: { error: String(e) } })
      }
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

  // For grants panel: fetch workspace members + existing grants (admins only)
  let grantsMembers: { user_id: string; role: string; profile: { email: string; full_name: string | null } | null }[] = []
  let grantsGrants: { user_id: string; level: 'read' | 'read_write' }[] = []
  if (isAdmin) {
    const [{ data: membersData }, { data: grantsData }] = await Promise.all([
      admin
        .from('memberships')
        .select('user_id, role, profile:profiles(email, full_name)')
        .eq('workspace_id', membership!.workspace_id)
        .eq('role', 'member'),
      admin
        .from('connection_grants')
        .select('user_id, level')
        .eq('connection_id', connectionId),
    ])
    // Supabase returns profile as array from the join; cast via unknown
    grantsMembers = (membersData ?? []) as unknown as typeof grantsMembers
    grantsGrants = (grantsData ?? []) as typeof grantsGrants
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        {manifest.logoUrl ? (
          <Image
            src={manifest.logoUrl}
            alt={connector.name}
            width={48}
            height={48}
            className="rounded-xl shrink-0"
            unoptimized
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-muted shrink-0 flex items-center justify-center text-lg font-bold text-muted-foreground">
            {connector.name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{connection.label}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {connector.name} · {connector.category}
          </p>
        </div>
        {connection.is_simulated && (
          <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/25 hover:bg-violet-500/20">
            Simulated
          </Badge>
        )}
        <Badge variant={connection.status === 'active' ? 'default' : 'destructive'}>
          {connection.status}
        </Badge>
      </div>

      {/* Convert to Real — shown only for simulated connections */}
      {connection.is_simulated && isAdmin && (
        <ConvertToRealPanel
          connectionId={connectionId}
          connectorSlug={connector.slug}
          connectorName={connector.name}
          currentLabel={connection.label}
          auth={manifest.auth}
        />
      )}

      {isAdmin && !connection.is_simulated && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Credentials</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Update the connection name or API key without losing skills or grants tied to this connection.
            </p>
          </div>
          <EditCredentialsPanel
            connectionId={connectionId}
            currentLabel={connection.label}
            auth={manifest.auth}
          />
        </section>
      )}

      {/* The "how do I actually use this?" answer, up top where new users look. */}
      <section className="grid sm:grid-cols-3 gap-3">
        <Link href={`/connectors/${connectionId}/manual`} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1 hover:border-primary/60 hover:bg-primary/10 transition-colors">
          <p className="text-sm font-semibold flex items-center gap-1.5">▶ Use it now</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Pick an action, fill in a field or two, and see the answer immediately — like using {connector.name} without logging in.</p>
        </Link>
        <Link href="/chat" className="rounded-xl border p-4 space-y-1 hover:border-primary/40 hover:bg-muted/40 transition-colors">
          <p className="text-sm font-semibold flex items-center gap-1.5">💬 Ask in plain English</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Orbit Assistant can answer questions like &ldquo;what came in this week?&rdquo; using this connection.</p>
        </Link>
        <Link href="/activity" className="rounded-xl border p-4 space-y-1 hover:border-primary/40 hover:bg-muted/40 transition-colors">
          <p className="text-sm font-semibold flex items-center gap-1.5">🕘 See past answers</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Every run and result is saved in Activity, so you can come back to a number later.</p>
        </Link>
      </section>

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

      <AccessControls
        connectionId={connectionId}
        initial={(connection as { allowed_risk_levels?: string[] | null }).allowed_risk_levels ?? null}
        canManage={isAdmin}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">What you can do with {connector.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {manifest.actions.some(a => a.slug === 'explore_api')
              ? <>These are ready-made shortcuts for the most common tasks. They&apos;re not the limit — OrbitAPI can reach {connector.name}&apos;s <span className="text-foreground font-medium">entire API</span>, including historical and bulk data the app&apos;s own screens cap or hide.</>
              : <>Ready-made shortcuts for {connector.name} — each one a common task made one-click. Ask the assistant in plain English to combine or filter them.</>}
          </p>
        </div>
        <ActionsList
          actions={manifest.actions.map(a => ({ slug: a.slug, name: a.name, risk: a.risk }))}
          connectorName={connector.name}
          connectorSlug={connector.slug}
        />
      </section>

      {/* Widgets (incl. the Widget Wizard) rely on a real backend; the wizard's
          preview/generate routes 404 ("Connection not found") for simulated
          connections, so hide the whole section for sims. Deliberately low on the
          page — it's a power feature, not the main way to use a connector. */}
      {!connection.is_simulated && (
        <WidgetBoard
          connectionId={connectionId}
          connectorName={connector.name}
          isAdmin={isAdmin}
        />
      )}

      {isAdmin && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Member access</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control which members can use this connection in Orbit Assistant, and at what level.
            </p>
          </div>
          <GrantsPanel
            connectionId={connectionId}
            initialMembers={grantsMembers}
            initialGrants={grantsGrants}
          />
        </section>
      )}

      <ReportIssuePanel connectorSlug={connector.slug} connectorName={connector.name} />

      {/* Examples section */}
      {CONNECTOR_EXAMPLES[connector.slug] && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">How to use this connector</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Example chat phrases and automation ideas for {connector.name}.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Chat phrases */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold">Orbit Assistant phrases</p>
                <p className="text-xs text-muted-foreground mt-0.5">Type these in the AI chat to use this connector</p>
              </div>
              <ul className="space-y-2">
                {CONNECTOR_EXAMPLES[connector.slug].chatPhrases.map((phrase, i) => (
                  <li key={i} className="flex items-start gap-2 group">
                    <span className="text-primary/40 text-xs mt-0.5 font-mono shrink-0">&gt;</span>
                    <span className="text-sm text-muted-foreground leading-snug">{phrase}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Open Orbit Assistant →
              </Link>
            </div>

            {/* Automation ideas */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold">Automation ideas</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pre-built skill workflows for {connector.name}</p>
              </div>
              <ul className="space-y-3">
                {CONNECTOR_EXAMPLES[connector.slug].automations.map((auto, i) => (
                  <li key={i} className="space-y-0.5">
                    <p className="text-sm font-medium">{auto.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{auto.description}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/skills"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Create a skill →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { connectorLimit } from '@/lib/entitlements'
import { connectors } from '@/connectors'
import { toSummary } from '@/connectors/types'
import { catalog } from '@/connectors/catalog'
import { ConnectionList } from './connection-list'
import { CatalogGrid } from './catalog-grid'
import { RequestConnectorForm } from './request-connector-form'
import { SectionIntro } from '@/components/section-intro'

export default async function ConnectorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [membershipResult, features] = await Promise.all([
    supabase.from('memberships').select('workspace_id, role').eq('user_id', user!.id).single(),
    getWorkspaceFeatures(),
  ])
  const membership = membershipResult.data

  const admin = createAdminClient()
  const [{ data: connections }, { data: recentBuilds }, { data: disabledOverrides }, { data: profile }] = await Promise.all([
    admin
      .from('connections')
      .select('*, connector:connectors(slug, name, category, is_simulated)')
      .eq('workspace_id', membership?.workspace_id)
      .order('created_at'),
    // AI-built connectors get priority in the "New" row
    admin
      .from('connector_builds')
      .select('connector_slug')
      .eq('status', 'complete')
      .not('connector_slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    // Disabled connectors are dimmed with "Unavailable" in the catalog
    admin
      .from('connector_overrides')
      .select('slug')
      .eq('disabled', true),
    // User's delete preference
    admin
      .from('profiles')
      .select('connection_delete_preference')
      .eq('id', user!.id)
      .single(),
  ])

  const canManage = membership?.role !== 'member'
  // Real (non-simulated, non-trashed) connections count toward the plan's connector limit.
  const realConnectionCount = (connections ?? []).filter(
    c => !(c.connector as { is_simulated?: boolean } | null)?.is_simulated && c.status !== 'trashed',
  ).length
  const limit = connectorLimit(features?.tier ?? 'free')
  const atConnectorLimit = realConnectionCount >= limit
  const deletePreference = (profile?.connection_delete_preference as 'trash' | 'permanent') ?? 'trash'
  const aiBuiltSlugs = new Set((recentBuilds ?? []).map(b => b.connector_slug!))
  const disabledSlugs = new Set((disabledOverrides ?? []).map(o => o.slug))

  // Sort catalog so AI-built connectors appear first (affects which 5 show in "New" row)
  const sortedCatalog = [...catalog].sort((a, b) => {
    const aNew = aiBuiltSlugs.has(a.slug)
    const bNew = aiBuiltSlugs.has(b.slug)
    return aNew === bNew ? 0 : aNew ? -1 : 1
  })

  // Build a map of slug → ConnectorSummary for connectors with full implementations
  const availableConnectors = Object.fromEntries(
    connectors.map(c => [c.slug, toSummary(c)])
  )

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">API Connectors</h1>
        <p className="text-muted-foreground mt-1">
          A connector is a ready-made link to an app&apos;s API. Browse {catalog.length}+ — connect your security tools, communication platforms, ERP systems, and more.
        </p>
      </div>

      <SectionIntro id="connectors" />

      {(connections ?? []).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your connections</h2>
            {Number.isFinite(limit) && (
              <span className="text-xs text-muted-foreground">
                {realConnectionCount} of {limit} connectors used
                {atConnectorLimit && <> · <a href="/upgrade" className="text-primary hover:underline">upgrade for more</a></>}
              </span>
            )}
          </div>
          <ConnectionList connections={connections ?? []} canManage={canManage} deletePreference={deletePreference} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API connector catalog</h2>
        <CatalogGrid
          catalog={sortedCatalog}
          availableConnectors={availableConnectors}
          canManage={canManage}
          atConnectorLimit={atConnectorLimit}
          disabledSlugs={disabledSlugs}
        />
      </section>

      <RequestConnectorForm />
    </div>
  )
}

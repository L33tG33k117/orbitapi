import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUILTIN_BUNDLES } from '@/lib/bundle-registry'
import { getConnector } from '@/connectors'
import type { BundleManifest } from '@/lib/bundles'
import { BundleCard, type BundleCardData } from './bundle-card'
import { pageGate } from '@/components/page-gate'
import { Package, Store } from 'lucide-react'

// Resolve connector slugs → display names so users see real app names, not slugs.
function enrich(manifest: BundleManifest, source: 'builtin' | 'marketplace', installed: boolean, isAdmin: boolean, installCount?: number): BundleCardData {
  return {
    slug: manifest.slug, name: manifest.name, description: manifest.description, category: manifest.category,
    source, installed, isAdmin, installCount,
    connectors: (manifest.connectors ?? []).map(c => ({ slug: c.slug, name: getConnector(c.slug)?.name ?? c.label ?? c.slug })),
    playbooks: (manifest.playbooks ?? []).map(p => ({ name: p.name, description: p.description })),
    skills: (manifest.skills ?? []).map(s => ({ name: s.name, description: s.description })),
  }
}

export default async function BundlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('bundles'); if (gate) return gate

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()

  const [{ data: installs }, { data: listings }] = await Promise.all([
    admin.from('bundle_installations').select('bundle_slug').eq('workspace_id', membership.workspace_id),
    admin.from('marketplace_listings').select('*').eq('status', 'approved').eq('kind', 'bundle').order('install_count', { ascending: false }),
  ])
  const installedSlugs = new Set((installs ?? []).map(i => i.bundle_slug))

  const builtin = BUILTIN_BUNDLES.map(b => enrich(b, 'builtin', installedSlugs.has(b.slug), isAdmin))
  const fromMarket = (listings ?? []).map(l => enrich(l.manifest as BundleManifest, 'marketplace', installedSlugs.has(l.slug), isAdmin, l.install_count))

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Bundles</h1>
          <p className="text-muted-foreground mt-1">
            Install a complete, pre-wired solution — API connectors, groups, playbooks, and skills — in one click.
          </p>
        </div>
        <Link href="/marketplace" className="shrink-0 whitespace-nowrap text-sm text-primary hover:underline inline-flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5" /> Browse marketplace
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> Vertical bundles</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {builtin.map(b => <BundleCard key={b.slug} {...b} />)}
        </div>
      </section>

      {fromMarket.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Store className="h-4 w-4 text-primary" /> From the marketplace</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {fromMarket.map(b => <BundleCard key={b.slug} {...b} />)}
          </div>
        </section>
      )}
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUILTIN_BUNDLES } from '@/lib/bundle-registry'
import { getConnector } from '@/connectors'
import type { BundleManifest } from '@/lib/bundles'
import { type BundleCardData } from './bundle-card'
import { type ExistingConnection } from './install-bundle-dialog'
import { BundlesClient } from './bundles-client'
import { pageGate } from '@/components/page-gate'
import { SectionIntro } from '@/components/section-intro'
import { Store } from 'lucide-react'

const nameFor = (slug: string, fallback?: string) => getConnector(slug)?.name ?? fallback ?? slug

// Resolve connector slugs → display names + alternatives so the bundle builder
// can offer reuse/substitution, and users see real app names rather than slugs.
function enrich(
  manifest: BundleManifest,
  source: 'builtin' | 'marketplace',
  installed: boolean,
  isAdmin: boolean,
  existingConnections: ExistingConnection[],
  installCount?: number,
): BundleCardData {
  return {
    slug: manifest.slug, name: manifest.name, description: manifest.description, category: manifest.category,
    source, installed, isAdmin, installCount, existingConnections,
    connectors: (manifest.connectors ?? []).map(c => ({
      slug: c.slug,
      name: nameFor(c.slug, c.label),
      role: c.role,
      alternatives: (c.alternatives ?? []).map(s => ({ slug: s, name: nameFor(s) })),
    })),
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

  const [{ data: installs }, { data: listings }, { data: conns }] = await Promise.all([
    admin.from('bundle_installations').select('bundle_slug').eq('workspace_id', membership.workspace_id),
    admin.from('marketplace_listings').select('*').eq('status', 'approved').eq('kind', 'bundle').order('install_count', { ascending: false }),
    admin
      .from('connections')
      .select('id, label, vault_secret_id, connector:connectors(slug, name)')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'trashed'),
  ])
  const installedSlugs = new Set((installs ?? []).map(i => i.bundle_slug))

  const existingConnections: ExistingConnection[] = (conns ?? []).map(c => ({
    id: c.id,
    label: c.label,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slug: (c.connector as any)?.slug ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (c.connector as any)?.name ?? '',
    configured: !!c.vault_secret_id,
  }))

  const builtin = BUILTIN_BUNDLES.map(b => enrich(b, 'builtin', installedSlugs.has(b.slug), isAdmin, existingConnections))
  const fromMarket = (listings ?? []).map(l => enrich(l.manifest as BundleManifest, 'marketplace', installedSlugs.has(l.slug), isAdmin, existingConnections, l.install_count))

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

      <SectionIntro id="bundles" />

      <BundlesClient builtin={builtin} marketplace={fromMarket} />
    </div>
  )
}

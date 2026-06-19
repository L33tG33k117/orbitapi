import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import type { BundleManifest } from '@/lib/bundles'
import { MarketplaceInstall } from './marketplace-install'
import { type ExistingConnection } from '../bundles/install-bundle-dialog'
import { PublishForm } from './publish-form'
import { ReviewButtons } from './review-buttons'
import { Store, Star } from 'lucide-react'

const nameFor = (slug: string, fallback?: string) => getConnector(slug)?.name ?? fallback ?? slug
function manifestConnectors(manifest: BundleManifest) {
  return (manifest?.connectors ?? []).map(c => ({
    slug: c.slug,
    name: nameFor(c.slug, c.label),
    role: c.role,
    alternatives: (c.alternatives ?? []).map(s => ({ slug: s, name: nameFor(s) })),
  }))
}

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()

  const [{ data: profile }, { data: approved }, { data: mine }, { data: installs }, { data: playbooks }, { data: skills }] = await Promise.all([
    admin.from('profiles').select('super_admin').eq('id', user!.id).single(),
    admin.from('marketplace_listings').select('*').eq('status', 'approved').order('install_count', { ascending: false }),
    admin.from('marketplace_listings').select('*').eq('publisher_user_id', user!.id).order('created_at', { ascending: false }),
    admin.from('bundle_installations').select('bundle_slug').eq('workspace_id', membership.workspace_id),
    admin.from('playbooks').select('id, name').eq('workspace_id', membership.workspace_id).order('name'),
    admin.from('skills').select('id, name').eq('workspace_id', membership.workspace_id).order('name'),
  ])
  const superAdmin = profile?.super_admin ?? false
  const installedSlugs = new Set((installs ?? []).map(i => i.bundle_slug))

  const { data: conns } = await admin
    .from('connections')
    .select('id, label, vault_secret_id, connector:connectors(slug, name)')
    .eq('workspace_id', membership.workspace_id)
    .neq('status', 'trashed')
  const existingConnections: ExistingConnection[] = (conns ?? []).map(c => ({
    id: c.id,
    label: c.label,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slug: (c.connector as any)?.slug ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (c.connector as any)?.name ?? '',
    configured: !!c.vault_secret_id,
  }))

  const { data: pending } = superAdmin
    ? await admin.from('marketplace_listings').select('*').eq('status', 'pending').order('created_at')
    : { data: [] }

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Marketplace</h1>
        <p className="text-muted-foreground mt-1">
          Install community-built bundles, or publish your own playbooks and skills and earn a revenue share.
        </p>
      </div>

      {/* Admin review queue */}
      {superAdmin && (pending ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-500">Pending review ({(pending ?? []).length})</h2>
          {(pending ?? []).map(l => (
            <div key={l.id} className="border border-amber-500/30 rounded-xl p-4 bg-amber-500/5 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{l.name} <span className="text-xs text-muted-foreground">· {l.category}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
              </div>
              <ReviewButtons id={l.id} />
            </div>
          ))}
        </section>
      )}

      {/* Browse approved */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Available</h2>
        {(approved ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nothing published yet. Be the first below.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {(approved ?? []).map(l => (
            <div key={l.id} className="border rounded-xl p-4 bg-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{l.name}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{l.category}</span>
                </div>
                {isAdmin && (
                  <MarketplaceInstall
                    slug={l.slug}
                    name={l.name}
                    installed={installedSlugs.has(l.slug)}
                    connectors={manifestConnectors(l.manifest as BundleManifest)}
                    existingConnections={existingConnections}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{l.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{l.install_count} installs</span>
                {l.rating_count > 0 && (
                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {(l.rating_sum / l.rating_count).toFixed(1)}</span>
                )}
                <span>{l.price_usd > 0 ? `$${l.price_usd}` : 'Free'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Publish */}
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Publish your work</h2>
          <PublishForm
            playbooks={(playbooks ?? []) as { id: string; name: string }[]}
            skills={(skills ?? []) as { id: string; name: string }[]}
          />
          {(mine ?? []).length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">Your submissions</p>
              {(mine ?? []).map(l => (
                <div key={l.id} className="flex items-center justify-between text-xs border rounded-lg px-3 py-2 bg-card">
                  <span>{l.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    l.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    l.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

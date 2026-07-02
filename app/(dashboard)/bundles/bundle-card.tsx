'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check, Download, ChevronDown, ChevronRight, Plug, ShieldAlert, Zap, Gauge } from 'lucide-react'
import { estimateRunCredits, formatCredits } from '@/lib/ai-estimate'
import { InstallBundleDialog, type BundleConnectorChoice, type ExistingConnection } from './install-bundle-dialog'

export interface BundleCardData {
  slug: string
  name: string
  description: string
  category: string
  source: 'builtin' | 'marketplace'
  installed: boolean
  installCount?: number
  isAdmin: boolean
  connectors: BundleConnectorChoice[]
  playbooks: { name: string; description?: string }[]
  skills: { name: string; description?: string }[]
  existingConnections: ExistingConnection[]
}

export function BundleCard(b: BundleCardData) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function uninstall() {
    if (!confirm(`Remove “${b.name}”? This deletes the skills, playbooks, groups, and connections it created. Connectors you already had are kept.`)) return
    setRemoving(true)
    const res = await fetch('/api/bundles/uninstall', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: b.slug }),
    })
    const data = await res.json()
    setRemoving(false)
    if (!res.ok) { toast.error(data.error ?? 'Uninstall failed'); return }
    toast.success(`Removed ${b.name}`)
    router.refresh()
  }

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{b.name}</p>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {b.category}{b.source === 'marketplace' && b.installCount != null ? ` · ${b.installCount} installs` : ''}
            </span>
          </div>
          {b.isAdmin && (b.installed ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500"><Check className="h-3.5 w-3.5" /> Installed</span>
              {b.skills.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => router.push('/skills')} className="gap-1">
                  <Zap className="h-3 w-3" /> Open skills
                </Button>
              )}
              <button onClick={uninstall} disabled={removing} className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 disabled:opacity-50">
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setDialogOpen(true)}><Download className="h-3.5 w-3.5" /> Install</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{b.description}</p>

        {b.skills.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Gauge className="h-3 w-3 text-primary shrink-0" />
            Est. <span className="font-medium text-foreground">~{formatCredits(estimateRunCredits('balanced').typical)} AI Power</span> per skill run
            <span className="text-muted-foreground/60">· installing is free</span>
          </p>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {open ? 'Hide contents' : 'See what\'s inside'}
          <span className="text-muted-foreground/60">
            · {b.playbooks.length} playbook{b.playbooks.length !== 1 ? 's' : ''}, {b.skills.length} skill{b.skills.length !== 1 ? 's' : ''}, {b.connectors.length} API connector{b.connectors.length !== 1 ? 's' : ''}
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t bg-muted/20 p-4 space-y-3 text-xs">
          {b.connectors.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-semibold mb-1.5"><Plug className="h-3.5 w-3.5 text-muted-foreground" /> API connectors</p>
              <div className="flex flex-wrap gap-1.5">
                {b.connectors.map(c => (
                  <span key={c.slug} className="px-2 py-0.5 rounded-md bg-background border text-[11px]">{c.name}</span>
                ))}
              </div>
            </div>
          )}
          {b.playbooks.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-semibold mb-1.5"><ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" /> Playbooks</p>
              <ul className="space-y-1">
                {b.playbooks.map((p, i) => (
                  <li key={i} className="text-muted-foreground"><span className="text-foreground font-medium">{p.name}</span>{p.description ? ` — ${p.description}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {b.skills.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-semibold mb-1.5"><Zap className="h-3.5 w-3.5 text-muted-foreground" /> Skills</p>
              <ul className="space-y-1">
                {b.skills.map((s, i) => (
                  <li key={i} className="text-muted-foreground"><span className="text-foreground font-medium">{s.name}</span>{s.description ? ` — ${s.description}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/70 pt-1">
            Installing adds these to your workspace. Reuse connectors you already have, or swap in a different vendor — no duplicates.
          </p>
        </div>
      )}

      {b.isAdmin && !b.installed && (
        <InstallBundleDialog
          slug={b.slug}
          bundleName={b.name}
          source={b.source}
          connectors={b.connectors}
          existingConnections={b.existingConnections}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  )
}

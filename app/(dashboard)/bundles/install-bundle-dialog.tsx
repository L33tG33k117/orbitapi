'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Download, Plug, Sparkles, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface BundleConnectorChoice {
  slug: string          // bundle's declared primary slug
  name: string
  role?: string
  alternatives: { slug: string; name: string }[]
}

export interface ExistingConnection {
  id: string
  label: string
  slug: string
  name: string
  configured: boolean
}

interface Props {
  slug: string
  bundleName: string
  source: 'builtin' | 'marketplace'
  connectors: BundleConnectorChoice[]
  existingConnections: ExistingConnection[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

// A selection is either reuse an existing connection or add a new one for a slug.
type Selection = { kind: 'existing'; connectionId: string; connectorSlug: string } | { kind: 'new'; connectorSlug: string }

export function InstallBundleDialog({ slug, bundleName, source, connectors, existingConnections, open, onOpenChange }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Build the option list + default selection for each bundle connector.
  const rows = useMemo(() => connectors.map(c => {
    const candidateSlugs = [c.slug, ...c.alternatives.map(a => a.slug)]
    const matches = existingConnections.filter(e => candidateSlugs.includes(e.slug))
    const options: { value: string; label: string; sel: Selection; reuse: boolean }[] = []
    for (const m of matches) {
      options.push({
        value: `existing:${m.id}`,
        label: `Use your “${m.label}”${m.configured ? '' : ' (needs credentials)'}`,
        sel: { kind: 'existing', connectionId: m.id, connectorSlug: m.slug },
        reuse: true,
      })
    }
    options.push({ value: `new:${c.slug}`, label: `Add ${c.name} — set up later`, sel: { kind: 'new', connectorSlug: c.slug }, reuse: false })
    for (const a of c.alternatives) {
      options.push({ value: `new:${a.slug}`, label: `Add ${a.name} instead — set up later`, sel: { kind: 'new', connectorSlug: a.slug }, reuse: false })
    }
    // Prefer a configured existing match, else any existing match, else add primary.
    const configured = matches.find(m => m.configured)
    const defaultValue = configured ? `existing:${configured.id}` : matches[0] ? `existing:${matches[0].id}` : `new:${c.slug}`
    return { connector: c, options, defaultValue }
  }), [connectors, existingConnections])

  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(r => [r.connector.slug, r.defaultValue])),
  )

  const selectionOf = (cslug: string): Selection => {
    const row = rows.find(r => r.connector.slug === cslug)!
    return (row.options.find(o => o.value === choices[cslug]) ?? row.options[0]).sel
  }

  const reuseCount = rows.filter(r => selectionOf(r.connector.slug).kind === 'existing').length
  const setupCount = rows.length - reuseCount

  async function install() {
    setLoading(true)
    const resolutions: Record<string, { connectionId?: string; connectorSlug: string }> = {}
    for (const r of rows) {
      const sel = selectionOf(r.connector.slug)
      resolutions[r.connector.slug] = sel.kind === 'existing'
        ? { connectionId: sel.connectionId, connectorSlug: sel.connectorSlug }
        : { connectorSlug: sel.connectorSlug }
    }
    const res = await fetch('/api/bundles/install', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, source, resolutions }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Install failed'); return }
    const setup = data.needsSetup ?? []
    if (setup.length) {
      toast.success(`Installed. Set up credentials for: ${setup.map((s: { name: string }) => s.name).join(', ')}`, {
        action: { label: 'Connectors', onClick: () => router.push('/connectors') },
      })
    } else {
      toast.success('Installed — using your existing connectors.')
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Install {bundleName}</DialogTitle>
          <DialogDescription>
            Choose how to fill each connector. Reuse what you already have, or swap in a different vendor —
            we won&apos;t create duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {rows.map(r => {
            const sel = selectionOf(r.connector.slug)
            const reuse = sel.kind === 'existing'
            return (
              <div key={r.connector.slug} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.connector.role ?? r.connector.name}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    reuse ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {reuse ? 'Connected' : 'Needs setup'}
                  </span>
                </div>
                <select
                  value={choices[r.connector.slug]}
                  onChange={e => setChoices(c => ({ ...c, [r.connector.slug]: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                >
                  {r.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>
            {reuseCount > 0 && <><span className="font-medium text-foreground">{reuseCount}</span> reused. </>}
            {setupCount > 0
              ? <><span className="font-medium text-foreground">{setupCount}</span> will be added and need credentials in API Connectors.</>
              : 'Everything is wired to connectors you already have.'}
          </span>
        </div>

        <Button onClick={install} disabled={loading} className="w-full gap-2">
          {loading ? 'Installing…' : <><Download className="h-4 w-4" /> Install bundle</>}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

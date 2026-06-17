'use client'

import { useState } from 'react'
import { InstallButton } from './install-button'
import { ChevronDown, ChevronRight, Plug, ShieldAlert, Zap } from 'lucide-react'

export interface BundleCardData {
  slug: string
  name: string
  description: string
  category: string
  source: 'builtin' | 'marketplace'
  installed: boolean
  installCount?: number
  isAdmin: boolean
  connectors: { slug: string; name: string }[]
  playbooks: { name: string; description?: string }[]
  skills: { name: string; description?: string }[]
}

export function BundleCard(b: BundleCardData) {
  const [open, setOpen] = useState(false)

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
          {b.isAdmin && <InstallButton slug={b.slug} source={b.source} installed={b.installed} />}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{b.description}</p>

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
            Installing adds these to your workspace. API connectors install ready to configure with your credentials.
          </p>
        </div>
      )}
    </div>
  )
}

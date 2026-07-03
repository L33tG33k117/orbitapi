'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Eye, Pencil, AlertTriangle, Globe } from 'lucide-react'

type Risk = 'read' | 'write' | 'destructive'

const OPTIONS: { key: Risk; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'read', label: 'Read', hint: 'List & fetch data', icon: Eye },
  { key: 'write', label: 'Write', hint: 'Create & update', icon: Pencil },
  { key: 'destructive', label: 'Destructive', hint: 'Delete, isolate, disable', icon: AlertTriangle },
]

// Per-connector access controls: cap which action classes this connection may
// run. Enforced server-side (chat, manual execute, skills, playbooks). Read is
// always kept on — a connection with nothing readable is useless.
export function AccessControls({ connectionId, initial, canManage, hasExplore = false, initialExploration = true }: {
  connectionId: string; initial: string[] | null; canManage: boolean
  /** True when this connector exposes the universal explore_api action. */
  hasExplore?: boolean
  initialExploration?: boolean
}) {
  const router = useRouter()
  const start = new Set<Risk>((initial && initial.length ? initial : ['read', 'write', 'destructive']) as Risk[])
  const [allowed, setAllowed] = useState<Set<Risk>>(new Set([...start, 'read']))
  const [exploration, setExploration] = useState(initialExploration)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function saveExploration(next: boolean) {
    setExploration(next)
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowApiExploration: next }),
    })
    setSaving(false)
    if (res.ok) { setMsg({ ok: true, text: 'Saved.' }); router.refresh() }
    else {
      setExploration(!next) // revert optimistic toggle
      const d = await res.json().catch(() => ({}))
      setMsg({ ok: false, text: d.error ?? 'Failed to save.' })
    }
  }

  async function save(next: Set<Risk>) {
    next.add('read')
    setAllowed(new Set(next))
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedRiskLevels: [...next] }),
    })
    setSaving(false)
    if (res.ok) { setMsg({ ok: true, text: 'Saved.' }); router.refresh() }
    else { const d = await res.json().catch(() => ({})); setMsg({ ok: false, text: d.error ?? 'Failed to save.' }) }
  }

  function toggle(key: Risk) {
    if (!canManage || key === 'read') return
    const next = new Set(allowed)
    if (next.has(key)) next.delete(key); else next.add(key)
    save(next)
  }

  const isReadOnly = !allowed.has('write') && !allowed.has('destructive')

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Access controls</h2>
        </div>
        {canManage && (
          <button
            onClick={() => save(new Set<Risk>(['read']))}
            disabled={saving || isReadOnly}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Make read-only
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground -mt-1">
        Limit what this connection is allowed to do. Disabled classes are blocked everywhere — chat, manual runs, skills, and playbooks.
      </p>
      <div className="grid sm:grid-cols-3 gap-2.5">
        {OPTIONS.map(o => {
          const on = allowed.has(o.key)
          const locked = o.key === 'read' || !canManage
          const Icon = o.icon
          return (
            <button
              key={o.key}
              onClick={() => toggle(o.key)}
              disabled={locked && o.key !== 'read'}
              className={`text-left rounded-xl border p-3 transition-colors ${
                on ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 opacity-70'
              } ${canManage && o.key !== 'read' ? 'hover:border-primary/60 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`h-4 w-7 rounded-full flex items-center transition-colors ${on ? 'bg-green-500' : 'bg-muted-foreground/30'}`}>
                  <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </span>
              </div>
              <p className="text-sm font-medium mt-2">{o.label}{o.key === 'read' && <span className="text-[10px] text-muted-foreground font-normal"> · always on</span>}</p>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
            </button>
          )
        })}
      </div>
      {isReadOnly && <p className="text-xs text-amber-500">This connection is read-only — it can fetch data but can&apos;t make changes.</p>}

      {hasExplore && (
        <div className={`rounded-xl border p-3 flex items-start gap-3 ${exploration ? 'border-border bg-muted/20' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <Globe className={`h-4 w-4 mt-0.5 shrink-0 ${exploration ? 'text-primary' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Open API exploration</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lets the assistant reach <span className="font-medium text-foreground">any</span> read endpoint of this API beyond the
              curated actions — powerful for all-time history, but broad. Turn off to allow only the built-in read actions
              {' '}(all reads stay audited either way).
            </p>
          </div>
          <button
            onClick={() => canManage && saveExploration(!exploration)}
            disabled={!canManage || saving}
            className={`mt-0.5 h-4 w-7 rounded-full flex items-center transition-colors shrink-0 disabled:opacity-50 ${exploration ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
            aria-label="Toggle open API exploration"
          >
            <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${exploration ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}

      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-destructive'}`}>{msg.text}</p>}
      {!canManage && <p className="text-xs text-muted-foreground">Only admins can change access controls.</p>}
    </section>
  )
}

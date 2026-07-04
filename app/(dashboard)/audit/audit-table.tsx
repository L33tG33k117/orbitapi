'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, ChevronDown, ChevronRight, Users, Plug, ShieldCheck, Settings, Lock, CreditCard, Zap, Wrench } from 'lucide-react'

interface ActionRow {
  id: string
  actor_type: string
  actor_label: string | null
  action_slug: string
  risk: string
  result_status: string
  result_summary: string | null
  response: unknown
  duration_ms: number | null
  params: Record<string, unknown> | null
  connection_id: string | null
  replay_of: string | null
  created_at: string
  connection: { label: string } | null
}

interface ChangeRow {
  id: string
  actor_email: string | null
  category: string
  action: string
  target: string | null
  summary: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const RISK_VARIANTS: Record<string, 'outline' | 'secondary' | 'destructive'> = {
  read: 'outline', write: 'secondary', destructive: 'destructive',
}

// Governance category → icon + colour, so the "who changed what" trail is scannable.
const CAT_META: Record<string, { label: string; icon: typeof Users; cls: string }> = {
  members: { label: 'Members', icon: Users, cls: 'bg-blue-500/10 text-blue-400' },
  connector: { label: 'Connector', icon: Plug, cls: 'bg-violet-500/10 text-violet-400' },
  access: { label: 'Access', icon: Lock, cls: 'bg-amber-500/10 text-amber-500' },
  workspace: { label: 'Workspace', icon: Settings, cls: 'bg-cyan-500/10 text-cyan-400' },
  security: { label: 'Security', icon: ShieldCheck, cls: 'bg-red-500/10 text-red-400' },
  billing: { label: 'Billing', icon: CreditCard, cls: 'bg-emerald-500/10 text-emerald-500' },
  automation: { label: 'Automation', icon: Zap, cls: 'bg-fuchsia-500/10 text-fuchsia-400' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

type Tab = 'changes' | 'actions' | 'all'

export function AuditTable({ changes, actions, isAdmin }: { changes: ChangeRow[]; actions: ActionRow[]; isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>(changes.length > 0 ? 'changes' : 'actions')
  const [search, setSearch] = useState('')
  const [window, setWindow] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [replaying, setReplaying] = useState<string | null>(null)

  const cutoff = useMemo(() => {
    const now = Date.now()
    const c: Record<string, number> = { '24h': now - 86400000, '7d': now - 7 * 86400000, '30d': now - 30 * 86400000 }
    return c[window] ?? 0
  }, [window])

  const visibleChanges = useMemo(() => changes.filter(c => {
    if (new Date(c.created_at).getTime() < cutoff) return false
    if (search) {
      const hay = `${c.summary} ${c.actor_email ?? ''} ${c.category} ${c.target ?? ''}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  }), [changes, cutoff, search])

  const visibleActions = useMemo(() => actions.filter(a => {
    if (new Date(a.created_at).getTime() < cutoff) return false
    if (search && !a.action_slug.toLowerCase().includes(search.toLowerCase()) &&
        !a.connection?.label?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [actions, cutoff, search])

  async function replay(r: ActionRow) {
    if (!r.connection_id) { toast.error('No connection on this entry — cannot replay'); return }
    setReplaying(r.id)
    const res = await fetch('/api/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: r.connection_id, actionSlug: r.action_slug, params: r.params ?? {}, replayOf: r.id }),
    })
    const data = await res.json()
    setReplaying(null)
    if (res.ok && data.ok) toast.success(`Replayed ${r.action_slug} · ${data.durationMs}ms`)
    else toast.error(data.error ?? 'Replay failed')
  }

  const showChanges = tab === 'changes' || tab === 'all'
  const showActions = tab === 'actions' || tab === 'all'
  const nothing = (showChanges ? visibleChanges.length : 0) + (showActions ? visibleActions.length : 0) === 0

  return (
    <div className="space-y-4">
      {/* Changes = who changed what · Actions = what ran */}
      <div className="flex gap-1 border-b">
        {([['changes', `Changes (${changes.length})`], ['actions', `Actions (${actions.length})`], ['all', 'All']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as Tab)}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring" />
        <select value={window} onChange={e => setWindow(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All time</option><option value="24h">Last 24h</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
        </select>
      </div>

      {tab === 'changes' && (
        <p className="text-xs text-muted-foreground -mb-1">Configuration &amp; governance — who changed what.</p>
      )}

      {nothing ? (
        <div className="py-12 text-center border rounded-lg text-muted-foreground"><p className="text-sm">Nothing matches your filters.</p></div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {/* Governance changes */}
          {showChanges && visibleChanges.map(c => {
            const meta = CAT_META[c.category] ?? { label: c.category, icon: Wrench, cls: 'bg-muted text-muted-foreground' }
            const Icon = meta.icon
            const isOpen = open === c.id
            const hasMeta = c.metadata && Object.keys(c.metadata).length > 0
            return (
              <div key={`c-${c.id}`}>
                <button onClick={() => hasMeta && setOpen(isOpen ? null : c.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasMeta ? 'hover:bg-muted/30' : ''} transition-colors`}>
                  {hasMeta ? (isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />) : <span className="w-3.5 shrink-0" />}
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-20" title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${meta.cls}`}><Icon className="h-3 w-3" /> {meta.label}</span>
                  <span className="flex-1 min-w-0 truncate text-sm">{c.summary}</span>
                  {c.actor_email && <span className="text-xs text-muted-foreground hidden sm:block max-w-[180px] truncate">{c.actor_email}</span>}
                </button>
                {isOpen && hasMeta && (
                  <div className="px-4 pb-4 pt-1 bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Details</p>
                    <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(c.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )
          })}

          {/* Actions run */}
          {showActions && visibleActions.map(r => {
            const isOpen = open === r.id
            const canReplay = isAdmin && !!r.connection_id
            return (
              <div key={`a-${r.id}`}>
                <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-20" title={new Date(r.created_at).toLocaleString()}>{timeAgo(r.created_at)}</span>
                  {tab === 'all' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 bg-muted text-muted-foreground"><Wrench className="h-3 w-3" /> Action</span>}
                  <span className="font-mono text-xs flex-1 min-w-0 truncate">
                    {r.action_slug}
                    {r.replay_of && <span className="ml-1.5 text-[10px] text-primary">(replay)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block w-28 truncate">{r.connection?.label ?? '—'}</span>
                  <Badge variant={RISK_VARIANTS[r.risk] ?? 'outline'} className="text-xs">{r.risk}</Badge>
                  <span className={`text-xs font-medium w-16 ${r.result_status === 'success' ? 'text-green-600' : 'text-destructive'}`}>{r.result_status}</span>
                  {r.duration_ms != null && <span className="text-[10px] text-muted-foreground w-12 text-right">{r.duration_ms}ms</span>}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-muted/20 space-y-3">
                    {isAdmin && <p className="text-[11px] text-muted-foreground">Actor: {r.actor_type}{r.actor_label ? ` · ${r.actor_label}` : ''}</p>}
                    {r.params && Object.keys(r.params).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Parameters</p>
                        <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(r.params, null, 2)}</pre>
                      </div>
                    )}
                    {r.response != null && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Response</p>
                        <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(r.response, null, 2)}</pre>
                      </div>
                    )}
                    {!r.response && r.result_summary && <p className="text-xs text-muted-foreground">{r.result_summary}</p>}
                    {canReplay && (
                      <Button size="sm" variant="outline" onClick={() => replay(r)} disabled={replaying === r.id}>
                        <RotateCcw className="h-3.5 w-3.5" /> {replaying === r.id ? 'Replaying…' : 'Replay with fresh data'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

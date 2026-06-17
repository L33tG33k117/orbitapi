'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'

interface AuditRow {
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

const RISK_VARIANTS: Record<string, 'outline' | 'secondary' | 'destructive'> = {
  read: 'outline', write: 'secondary', destructive: 'destructive',
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

export function AuditTable({ rows, isAdmin }: { rows: AuditRow[]; isAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('all')
  const [status, setStatus] = useState('all')
  const [window, setWindow] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [replaying, setReplaying] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoffs: Record<string, number> = { '24h': now - 86400000, '7d': now - 7 * 86400000, '30d': now - 30 * 86400000 }
    return rows.filter(r => {
      if (search && !r.action_slug.toLowerCase().includes(search.toLowerCase()) &&
          !r.connection?.label?.toLowerCase().includes(search.toLowerCase())) return false
      if (risk !== 'all' && r.risk !== risk) return false
      if (status !== 'all' && r.result_status !== status) return false
      if (window !== 'all' && new Date(r.created_at).getTime() < cutoffs[window]) return false
      return true
    })
  }, [rows, search, risk, status, window])

  async function replay(r: AuditRow) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action or connection…"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring" />
        <select value={risk} onChange={e => setRisk(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All risks</option><option value="read">Read</option><option value="write">Write</option><option value="destructive">Destructive</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All statuses</option><option value="success">Success</option><option value="error">Error</option>
        </select>
        <select value={window} onChange={e => setWindow(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All time</option><option value="24h">Last 24h</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
        </select>
        {filtered.length !== rows.length && <span className="text-xs text-muted-foreground">{filtered.length} of {rows.length} entries</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center border rounded-lg text-muted-foreground"><p className="text-sm">No entries match your filters.</p></div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {filtered.map(r => {
            const isOpen = open === r.id
            const canReplay = isAdmin && !!r.connection_id
            return (
              <div key={r.id}>
                <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-20" title={new Date(r.created_at).toLocaleString()}>{timeAgo(r.created_at)}</span>
                  <span className="font-mono text-xs flex-1 min-w-0 truncate">
                    {r.action_slug}
                    {r.replay_of && <span className="ml-1.5 text-[10px] text-primary">(replay)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block w-32 truncate">{r.connection?.label ?? '—'}</span>
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

'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  RotateCcw, ChevronDown, ChevronRight, MessageSquare, Zap, ShieldAlert, Wrench,
} from 'lucide-react'
import { ResultExport } from '@/components/result-export'

export interface ActivityStep {
  step?: number
  tool_name?: string
  status?: string
  params?: Record<string, unknown>
  note?: string
  risk?: string
}

export interface ActivityItem {
  kind: 'action' | 'automation'
  id: string
  title: string
  source: 'action' | 'replay' | 'skill' | 'playbook'
  at: string
  status: string
  simulated?: boolean
  // action
  connectionLabel?: string | null
  connectionId?: string | null
  actionSlug?: string
  risk?: string
  durationMs?: number | null
  params?: Record<string, unknown> | null
  response?: unknown
  summary?: string | null
  // automation
  mode?: string
  triggeredBy?: string
  steps?: ActivityStep[]
  error?: string | null
}

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

function prettyTitle(s: string) {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// success | error | other — normalizes both action and run statuses.
function normStatus(s: string): 'success' | 'error' | 'other' {
  if (s === 'success' || s === 'completed') return 'success'
  if (s === 'error' || s === 'failed' || s === 'cancelled') return 'error'
  return 'other'
}

const SOURCE_META: Record<ActivityItem['source'], { label: string; icon: typeof Zap }> = {
  action: { label: 'Action', icon: Wrench },
  replay: { label: 'Replay', icon: RotateCcw },
  skill: { label: 'Skill', icon: Zap },
  playbook: { label: 'Playbook', icon: ShieldAlert },
}

// Pull the most table-like array out of an API response (handles top-level
// arrays, { items: [...] }, and one level of nesting like { QueryResponse: { Invoice: [...] } }).
function extractRows(resp: unknown): { rows: Record<string, unknown>[]; key: string } | null {
  if (Array.isArray(resp)) {
    return resp.length && typeof resp[0] === 'object' && resp[0] !== null
      ? { rows: resp as Record<string, unknown>[], key: '' }
      : null
  }
  if (resp && typeof resp === 'object') {
    const entries = Object.entries(resp as Record<string, unknown>)
    for (const [k, v] of entries) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null) {
        return { rows: v as Record<string, unknown>[], key: k }
      }
    }
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
          if (Array.isArray(v2) && v2.length && typeof v2[0] === 'object' && v2[0] !== null) {
            return { rows: v2 as Record<string, unknown>[], key: `${k} › ${k2}` }
          }
        }
      }
    }
  }
  return null
}

function cell(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} item(s)` : '{…}'
  return String(v)
}

// Friendly, non-technical rendering of an action's result.
function ResultView({ response, summary, exportName }: { response: unknown; summary?: string | null; exportName: string }) {
  const [raw, setRaw] = useState(false)

  if (response == null) {
    return <p className="text-sm text-muted-foreground">{summary || 'Completed.'}</p>
  }

  const table = extractRows(response)
  let body: React.ReactNode

  if (table) {
    const cols = Object.keys(table.rows[0])
      .filter(k => typeof table.rows[0][k] !== 'object' || table.rows[0][k] === null)
      .slice(0, 4)
    const shown = table.rows.slice(0, 5)
    body = (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {table.rows.length} result{table.rows.length !== 1 ? 's' : ''}{table.key ? ` (${table.key})` : ''}
        </p>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>{cols.map(c => <th key={c} className="text-left font-semibold px-2 py-1.5">{prettyTitle(c)}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={i} className="border-t">
                  {cols.map(c => <td key={c} className="px-2 py-1.5 whitespace-nowrap max-w-[220px] truncate">{cell(row[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.rows.length > shown.length && (
          <p className="text-[11px] text-muted-foreground">Showing {shown.length} of {table.rows.length} — open “View raw” for everything.</p>
        )}
      </div>
    )
  } else if (typeof response === 'object') {
    const fields = Object.entries(response as Record<string, unknown>)
      .filter(([, v]) => typeof v !== 'object' || v === null)
      .slice(0, 8)
    body = fields.length ? (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{prettyTitle(k)}</dt>
            <dd className="font-medium truncate">{cell(v)}</dd>
          </div>
        ))}
      </dl>
    ) : <p className="text-sm text-muted-foreground">Done.</p>
  } else {
    body = <p className="text-sm font-medium">{String(response)}</p>
  }

  return (
    <div className="space-y-2">
      {body}
      <div className="flex items-center gap-3">
        <button onClick={() => setRaw(r => !r)} className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {raw ? 'Hide raw' : 'View raw'}
        </button>
        <ResultExport data={response} baseName={exportName} variant="compact" />
      </div>
      {raw && (
        <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto max-h-60 border">{JSON.stringify(response, null, 2)}</pre>
      )}
    </div>
  )
}

function StepRow({ s }: { s: ActivityStep }) {
  const color = {
    success: 'text-green-600', error: 'text-destructive', dry_run: 'text-blue-600',
    blocked: 'text-orange-500', awaiting_approval: 'text-amber-500', text: 'text-muted-foreground',
  }[s.status ?? ''] ?? 'text-muted-foreground'
  return (
    <div className="flex gap-3 text-xs py-1.5 border-b last:border-0">
      <span className="text-muted-foreground w-5 shrink-0 text-right">{s.step ?? '·'}</span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${color}`}>
          {s.status === 'dry_run' ? '◦ Would: ' : s.status === 'awaiting_approval' ? '⏳ Awaiting approval: ' : s.status === 'blocked' ? '✕ Blocked: ' : s.status === 'error' ? '✕ Error: ' : '✓ '}
        </span>
        <span>{s.tool_name ?? 'step'}</span>
        {s.note && <span className="text-muted-foreground ml-1">— {s.note}</span>}
      </div>
      {s.risk && <Badge variant={s.risk === 'read' ? 'outline' : 'secondary'} className="shrink-0 text-xs">{s.risk}</Badge>}
    </div>
  )
}

// ── card ───────────────────────────────────────────────────────────────────

function ActivityCard({ item, isAdmin }: { item: ActivityItem; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const meta = SOURCE_META[item.source]
  const Icon = item.kind === 'automation' && item.source === 'skill' ? Zap
    : item.source === 'playbook' ? ShieldAlert
    : item.source === 'replay' ? RotateCcw
    : item.kind === 'action' ? Wrench
    : MessageSquare
  const ns = normStatus(item.status)
  const statusColor = ns === 'success' ? 'text-green-600' : ns === 'error' ? 'text-destructive' : 'text-muted-foreground'
  const canReplay = isAdmin && item.kind === 'action' && !!item.connectionId

  async function replay() {
    if (!item.connectionId || !item.actionSlug) return
    setReplaying(true)
    const res = await fetch('/api/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: item.connectionId, actionSlug: item.actionSlug, params: item.params ?? {}, replayOf: item.id }),
    })
    const data = await res.json()
    setReplaying(false)
    if (res.ok && data.ok) toast.success(`Replayed ${item.actionSlug} · ${data.durationMs}ms`)
    else toast.error(data.error ?? 'Replay failed')
  }

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground whitespace-nowrap w-20" title={new Date(item.at).toLocaleString()}>{timeAgo(item.at)}</span>
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{prettyTitle(item.title)}</span>
        {item.simulated && <Badge variant="outline" className="text-[10px] shrink-0">simulated</Badge>}
        <span className="text-xs text-muted-foreground hidden md:block w-28 truncate">{item.connectionLabel ?? meta.label}</span>
        <span className={`text-xs font-medium w-16 ${statusColor}`}>{item.status}</span>
        {item.durationMs != null && <span className="text-[10px] text-muted-foreground w-12 text-right">{item.durationMs}ms</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/20 space-y-3">
          {/* The answer */}
          {item.kind === 'automation' ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {item.mode && <Badge variant={item.mode === 'live' ? 'default' : 'secondary'} className="text-[10px]">{item.mode === 'live' ? 'Live' : 'Dry run'}</Badge>}
                {item.triggeredBy && <span>triggered by {item.triggeredBy}</span>}
              </div>
              {item.summary
                ? <p className="text-sm whitespace-pre-wrap">{item.summary}</p>
                : <p className="text-sm text-muted-foreground">No summary recorded for this run.</p>}
              {item.error && <p className="text-xs text-destructive">Error: {item.error}</p>}
              {!!item.steps?.length && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{item.steps.length} step{item.steps.length !== 1 ? 's' : ''}</summary>
                  <div className="mt-1">{item.steps.map((s, i) => <StepRow key={i} s={s} />)}</div>
                </details>
              )}
            </>
          ) : (
            <>
              <ResultView response={item.response} summary={item.summary} exportName={item.actionSlug ?? item.title ?? 'result'} />
              {item.params && Object.keys(item.params).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Inputs</summary>
                  <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto max-h-40 border mt-1">{JSON.stringify(item.params, null, 2)}</pre>
                </details>
              )}
              {canReplay && (
                <Button size="sm" variant="outline" onClick={replay} disabled={replaying}>
                  <RotateCcw className="h-3.5 w-3.5" /> {replaying ? 'Replaying…' : 'Run again with fresh data'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── feed ───────────────────────────────────────────────────────────────────

export function ActivityFeed({ items, isAdmin }: { items: ActivityItem[]; isAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [status, setStatus] = useState('all')
  const [window, setWindow] = useState('all')

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoffs: Record<string, number> = { '24h': now - 86400000, '7d': now - 7 * 86400000, '30d': now - 30 * 86400000 }
    return items.filter(it => {
      if (search) {
        const hay = `${it.title} ${it.connectionLabel ?? ''} ${it.summary ?? ''}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      if (source === 'actions' && it.kind !== 'action') return false
      if (source === 'skill' && it.source !== 'skill') return false
      if (source === 'playbook' && it.source !== 'playbook') return false
      if (status !== 'all' && normStatus(it.status) !== status) return false
      if (window !== 'all' && new Date(it.at).getTime() < cutoffs[window]) return false
      return true
    })
  }, [items, search, source, status, window])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-ring" />
        <select value={source} onChange={e => setSource(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All sources</option>
          <option value="actions">Actions (manual)</option>
          <option value="skill">Skills</option>
          <option value="playbook">Playbooks</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="other">In progress</option>
        </select>
        <select value={window} onChange={e => setWindow(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        {filtered.length !== items.length && <span className="text-xs text-muted-foreground">{filtered.length} of {items.length}</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center border rounded-lg text-muted-foreground"><p className="text-sm">Nothing matches your filters.</p></div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {filtered.map(it => <ActivityCard key={`${it.source}-${it.id}`} item={it} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  )
}

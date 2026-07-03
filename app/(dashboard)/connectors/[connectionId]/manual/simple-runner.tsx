'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Search, Terminal, Eye, Pencil, AlertTriangle, ChevronRight, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toTable } from '@/lib/export-data'
import { ResultExport } from '@/components/result-export'

interface ActionParam {
  key: string
  type: string
  description: string
  enum: string[] | null
  required: boolean
}
interface ActionDef {
  slug: string
  name: string
  description: string
  risk: 'read' | 'write' | 'destructive'
  params: ActionParam[]
}

interface Props {
  connectionId: string
  connectionLabel: string
  connectorName: string
  connectorSlug: string
  status: string
  actions: ActionDef[]
  onAdvanced: () => void
}

const RISK_META = {
  read: { label: 'Get info', icon: Eye, cls: 'text-emerald-500', chip: 'bg-emerald-500/10 text-emerald-500' },
  write: { label: 'Make a change', icon: Pencil, cls: 'text-amber-500', chip: 'bg-amber-500/10 text-amber-500' },
  destructive: { label: 'Delete / high-impact', icon: AlertTriangle, cls: 'text-red-500', chip: 'bg-red-500/10 text-red-500' },
} as const

function pretty(key: string) {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Friendly table view of a result (reuses the same extractor the exporter uses,
// so what you see is exactly what you export).
function ResultTable({ data }: { data: unknown }) {
  const t = useMemo(() => toTable(data), [data])
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? t.rows : t.rows.slice(0, 12)
  const cols = t.columns.slice(0, 6)

  if (!t.isCollection && t.rows.length <= 1 && t.columns.includes('value')) {
    return <p className="text-sm">{String(t.rows[0]?.value ?? 'Done.')}</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t.isCollection ? `${t.rows.length} result${t.rows.length !== 1 ? 's' : ''}` : 'Details'}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>{cols.map(c => <th key={c} className="text-left font-semibold px-2.5 py-2 whitespace-nowrap">{pretty(c)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map(c => (
                  <td key={c} className="px-2.5 py-2 max-w-[240px] truncate" title={String(r[c] ?? '')}>{String(r[c] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.rows.length > 12 && (
        <button onClick={() => setShowAll(s => !s)} className="text-[11px] text-primary hover:underline">
          {showAll ? 'Show less' : `Show all ${t.rows.length}`}
        </button>
      )}
    </div>
  )
}

export function SimpleActionRunner({ connectionId, connectionLabel, connectorName, connectorSlug, status, actions, onAdvanced }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ActionDef | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; data?: unknown; error?: string; durationMs: number } | null>(null)

  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const match = (a: ActionDef) => !q || a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    const visible = actions.filter(a => a.slug !== 'explore_api' && match(a))
    return (['read', 'write', 'destructive'] as const)
      .map(risk => ({ risk, items: visible.filter(a => a.risk === risk) }))
      .filter(g => g.items.length > 0)
  }, [actions, q])

  function selectAction(a: ActionDef) {
    setSelected(a)
    setResult(null)
    setConfirmOpen(false)
    const init: Record<string, string> = {}
    for (const p of a.params) init[p.key] = p.enum?.[0] ?? ''
    setValues(init)
  }

  const missingRequired = selected?.params.filter(p => p.required && !values[p.key]?.trim()) ?? []

  async function run() {
    if (!selected) return
    setConfirmOpen(false)
    setRunning(true)
    setResult(null)
    // Coerce typed values; drop blanks so optional params are omitted.
    const params: Record<string, unknown> = {}
    for (const p of selected.params) {
      const v = values[p.key]
      if (v === undefined || v === '') continue
      params[p.key] = (p.type === 'integer' || p.type === 'number') ? Number(v)
        : p.type === 'boolean' ? (v === 'true' || v === 'yes')
        : v
    }
    const start = Date.now()
    try {
      const res = await fetch('/api/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, actionSlug: selected.slug, params }),
      })
      const data = await res.json()
      setResult({ ok: !!data.ok, data: data.data, error: data.error, durationMs: Date.now() - start })
    } catch (e) {
      setResult({ ok: false, error: String(e), durationMs: Date.now() - start })
    } finally {
      setRunning(false)
    }
  }

  function onRunClick() {
    if (!selected) return
    if (missingRequired.length) return
    if (selected.risk !== 'read') { setConfirmOpen(true); return }
    run()
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/connectors/${connectionId}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">Use {connectionLabel}</h1>
          <p className="text-xs text-muted-foreground">{connectorName}{status !== 'active' ? ` · ${status}` : ''}</p>
        </div>
        <button data-tour="run-advanced" onClick={onAdvanced} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border px-2.5 py-1.5 transition-colors">
          <Terminal className="h-3.5 w-3.5" /> Advanced (code)
        </button>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Pick something to do below, fill in the blanks, and see the answer — no code. When you have the result you can
          <span className="text-foreground font-medium"> export it to Excel, PDF, and more</span>.
        </p>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Action picker */}
        <div data-tour="run-picker" className="rounded-xl border bg-card overflow-hidden">
          <div className="p-2.5 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search what you can do…"
                className="w-full h-9 rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
            {groups.map(g => {
              const meta = RISK_META[g.risk]
              const Icon = meta.icon
              return (
                <div key={g.risk}>
                  <p className={cn('flex items-center gap-1.5 px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider', meta.cls)}>
                    <Icon className="h-3 w-3" /> {meta.label} ({g.items.length})
                  </p>
                  <div className="space-y-0.5">
                    {g.items.map(a => (
                      <button
                        key={a.slug}
                        onClick={() => selectAction(a)}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2',
                          selected?.slug === a.slug ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50',
                        )}
                      >
                        <span className="flex-1 min-w-0 truncate">{a.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {groups.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>}
          </div>
        </div>

        {/* Form + result */}
        <div data-tour="run-form" className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              <Play className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Choose something from the left to get started.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{selected.name}</h2>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', RISK_META[selected.risk].chip)}>
                    {RISK_META[selected.risk].label}
                  </span>
                </div>
                {selected.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{selected.description}</p>}
              </div>

              {selected.params.length > 0 ? (
                <div className="space-y-3">
                  {selected.params.map(p => (
                    <div key={p.key} className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        {pretty(p.key)}
                        {p.required
                          ? <span className="text-red-500 text-xs">required</span>
                          : <span className="text-muted-foreground text-[11px] font-normal">optional</span>}
                      </label>
                      {p.description && <p className="text-[11px] text-muted-foreground -mt-0.5">{p.description}</p>}
                      {p.enum ? (
                        <select
                          value={values[p.key] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          {!p.required && <option value="">— any —</option>}
                          {p.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : p.type === 'boolean' ? (
                        <select
                          value={values[p.key] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          <option value="">—</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          value={values[p.key] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                          inputMode={p.type === 'integer' || p.type === 'number' ? 'numeric' : undefined}
                          placeholder={p.type === 'integer' || p.type === 'number' ? 'a number' : `Enter ${pretty(p.key).toLowerCase()}`}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No details needed — just run it.</p>
              )}

              {!confirmOpen ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={onRunClick}
                    disabled={running || missingRequired.length > 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    <Play className="h-3.5 w-3.5" /> {running ? 'Working…' : 'Run'}
                  </button>
                  {missingRequired.length > 0 && (
                    <p className="text-xs text-muted-foreground">Fill in: {missingRequired.map(p => pretty(p.key)).join(', ')}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    This will {selected.risk === 'destructive' ? 'delete or make a high-impact change' : 'make a change'} in {connectorName}.
                  </p>
                  <p className="text-xs text-muted-foreground">Real actions are logged, and admins can require approval. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={run} disabled={running} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40">
                      {running ? 'Working…' : 'Yes, run it'}
                    </button>
                    <button onClick={() => setConfirmOpen(false)} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={cn('rounded-xl border p-5 space-y-3', result.ok ? 'bg-card' : 'border-destructive/30 bg-destructive/5')}>
              <div className="flex items-center gap-2">
                {result.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <XCircle className="h-4 w-4 text-destructive" />}
                <p className="text-sm font-semibold">{result.ok ? 'Here you go' : 'That didn\'t work'}</p>
                <span className="text-[11px] text-muted-foreground ml-auto">{result.durationMs}ms</span>
              </div>
              {result.ok ? (
                <>
                  <ResultTable data={result.data} />
                  <div className="flex items-center gap-3 pt-1">
                    <ResultExport data={result.data} baseName={`${connectorSlug}_${selected?.slug ?? 'result'}`} variant="ghost" />
                    <span className="text-[11px] text-muted-foreground">Save this to Excel, CSV, PDF, Word…</span>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm text-destructive break-words">{result.error}</p>
                  <p className="text-xs text-muted-foreground">
                    If this mentions a key or permission, the connection may need setup — check{' '}
                    <Link href={`/connectors/${connectionId}`} className="text-primary hover:underline">its settings</Link>, or use the
                    Feedback button (top-right) and we&apos;ll help.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

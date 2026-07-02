'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight, ChevronDown, Play, AlertTriangle, BookOpen, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { PageHero } from '@/components/page-hero'

interface ParamDef {
  type: string
  description?: string
  enum?: unknown[]
  [key: string]: unknown
}

interface ActionDef {
  slug: string
  name: string
  description: string
  risk: 'read' | 'write' | 'destructive'
  inputSchema: {
    type: string
    properties?: Record<string, ParamDef>
    required?: string[]
  }
}

interface ConnectorEntry {
  connectionId: string
  label: string
  slug: string
  name: string
  category: string
  actions: ActionDef[]
}

const RISK_STYLES = {
  read:        'bg-emerald-500/10 text-emerald-400',
  write:       'bg-amber-500/10 text-amber-400',
  destructive: 'bg-red-500/10 text-red-400',
}

interface RunResult {
  ok: boolean
  data?: unknown
  error?: string
  durationMs?: number
}

export function RefClient({ connectors }: { connectors: ConnectorEntry[] }) {
  const [search, setSearch] = useState('')
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, RunResult>>({})
  const [params, setParams] = useState<Record<string, Record<string, string>>>({})

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return connectors
    return connectors.map(c => ({
      ...c,
      actions: c.actions.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q)
      ),
    })).filter(c => c.actions.length > 0)
  }, [connectors, search])

  function toggleAction(key: string) {
    setExpandedActions(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function setParam(actionKey: string, paramKey: string, value: string) {
    setParams(prev => ({
      ...prev,
      [actionKey]: { ...(prev[actionKey] ?? {}), [paramKey]: value },
    }))
  }

  async function runAction(connectionId: string, actionSlug: string, action: ActionDef) {
    const key = `${connectionId}::${actionSlug}`
    setRunning(key)
    const p = params[key] ?? {}

    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, actionSlug, params: p }),
    })
    const data = await res.json()
    setResults(prev => ({ ...prev, [key]: data }))
    setRunning(null)
  }

  const totalActions = connectors.reduce((s, c) => s + c.actions.length, 0)

  if (connectors.length === 0) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-2.5 mb-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Connector Actions</h1>
        </div>
        <div className="py-20 text-center border border-dashed rounded-2xl space-y-3">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium">No connected APIs yet</p>
          <p className="text-sm text-muted-foreground">Connect your first API from the API Connectors page to see available commands here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <PageHero
        eyebrow="Operate"
        title="Connector Actions"
        description="Full, searchable docs for every command your connected APIs can run — and a way to run them directly."
        stats={[
          { label: 'connected APIs', value: connectors.length },
          { label: 'commands', value: totalActions },
        ]}
      />
      <div className="flex justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search commands…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Intro callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-medium text-primary">Direct API execution</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Execute any command directly — no AI needed. Expand an action, fill in the parameters, and hit Run.
          Read actions return data immediately. Write actions go through the normal approval flow.
          Every call is logged to the Audit Log.
        </p>
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">No commands match &quot;{search}&quot;</div>
      )}

      {filtered.map(c => (
        <section key={c.connectionId} className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <h2 className="text-sm font-semibold">{c.label}</h2>
            <span className="text-xs text-muted-foreground">{c.name}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
              {c.actions.length} command{c.actions.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="rounded-xl border bg-card divide-y divide-border/50 overflow-hidden">
            {c.actions.map(action => {
              const key = `${c.connectionId}::${action.slug}`
              const expanded = expandedActions.has(key)
              const result = results[key]
              const isRunning = running === key
              const properties = action.inputSchema?.properties ?? {}
              const required = action.inputSchema?.required ?? []

              return (
                <div key={action.slug} className="group">
                  <button
                    onClick={() => toggleAction(key)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${RISK_STYLES[action.risk]}`}>
                      {action.risk.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{action.name}</p>
                        <code className="text-[11px] text-muted-foreground font-mono">{action.slug}</code>
                      </div>
                      {!expanded && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{action.description}</p>
                      )}
                    </div>
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border/50 bg-muted/10">
                      <p className="text-xs text-muted-foreground pt-3 leading-relaxed">{action.description}</p>

                      {action.risk !== 'read' && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/20">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {action.risk === 'destructive'
                            ? 'Destructive — this action permanently modifies or deletes data.'
                            : 'Write — this action creates or modifies data and will require approval.'}
                        </div>
                      )}

                      {/* Parameters */}
                      {Object.keys(properties).length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Parameters</p>
                          <div className="space-y-2">
                            {Object.entries(properties).map(([paramKey, paramDef]) => {
                              const isRequired = required.includes(paramKey)
                              return (
                                <div key={paramKey} className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-primary">{paramKey}</code>
                                    <span className="text-[10px] text-muted-foreground">{paramDef.type}</span>
                                    {isRequired && <span className="text-[10px] text-red-400 font-medium">required</span>}
                                    {paramDef.enum && (
                                      <span className="text-[10px] text-muted-foreground">
                                        one of: {(paramDef.enum as string[]).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  {paramDef.description && (
                                    <p className="text-[11px] text-muted-foreground">{paramDef.description}</p>
                                  )}
                                  {paramDef.enum ? (
                                    <select
                                      value={params[key]?.[paramKey] ?? ''}
                                      onChange={e => setParam(key, paramKey, e.target.value)}
                                      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                      <option value="">Select…</option>
                                      {(paramDef.enum as string[]).map(v => (
                                        <option key={v} value={v}>{v}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={paramDef.type === 'number' || paramDef.type === 'integer' ? 'number' : 'text'}
                                      value={params[key]?.[paramKey] ?? ''}
                                      onChange={e => setParam(key, paramKey, e.target.value)}
                                      placeholder={isRequired ? `${paramKey} (required)` : paramKey}
                                      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/60"
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {Object.keys(properties).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No parameters required.</p>
                      )}

                      <button
                        onClick={() => runAction(c.connectionId, action.slug, action)}
                        disabled={isRunning}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50',
                          action.risk === 'destructive' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' :
                          action.risk === 'write' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                        )}
                      >
                        <Play className="h-3 w-3" />
                        {isRunning ? 'Running…' : 'Run'}
                      </button>

                      {result && (
                        <div className={cn('rounded-lg p-3 space-y-1.5', result.ok ? 'bg-muted/30' : 'bg-red-500/5 border border-red-500/20')}>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[10px] font-bold', result.ok ? 'text-emerald-400' : 'text-red-400')}>
                              {result.ok ? 'SUCCESS' : 'ERROR'}
                            </span>
                            {result.durationMs && <span className="text-[10px] text-muted-foreground">{result.durationMs}ms</span>}
                          </div>
                          {result.ok ? (
                            <pre className="text-[11px] font-mono text-foreground/80 overflow-auto max-h-48 leading-relaxed whitespace-pre-wrap break-all">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          ) : (
                            <p className="text-xs text-red-400">{result.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

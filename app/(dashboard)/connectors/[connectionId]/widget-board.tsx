'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, Plus, Trash2, X, ChevronRight, Loader2, Check,
  Shield, ShieldOff, ShieldCheck, Lock, Unlock, Zap, ZapOff,
  Bell, BellOff, AlertTriangle, AlertCircle, CheckCircle, XCircle,
  Power, Play, Pause, RotateCcw, Search, List, Eye, Download, Send, Mail,
  Sun, Moon, Lightbulb, Home, Building, Users, User, UserX, Server, Globe,
  Wifi, WifiOff, Activity, BarChart2, TrendingUp, TrendingDown,
  Trash2 as Trash, RefreshCw, Settings, Key, Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  Shield, ShieldOff, ShieldCheck, Lock, Unlock, Zap, ZapOff,
  Bell, BellOff, AlertTriangle, AlertCircle, CheckCircle, XCircle,
  Power, Play, Pause, Stop: X, RotateCcw, Search, List, Eye, Download, Send, Mail,
  Sun, Moon, Lightbulb, Home, Building, Users, User, UserX, Server, Globe,
  Wifi, WifiOff, Activity, BarChart2, TrendingUp, TrendingDown,
  Trash2: Trash, RefreshCw, Settings, Key, Flag, PowerOff: Power,
}

const COLOR_STYLES: Record<string, { button: string; badge: string; dot: string }> = {
  blue:    { button: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/20',     badge: 'bg-blue-500/15 text-blue-300',     dot: 'bg-blue-400' },
  emerald: { button: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20', badge: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-400' },
  amber:   { button: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20', badge: 'bg-amber-500/15 text-amber-300',   dot: 'bg-amber-400' },
  red:     { button: 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/20',         badge: 'bg-red-500/15 text-red-300',       dot: 'bg-red-400' },
  purple:  { button: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/20', badge: 'bg-purple-500/15 text-purple-300', dot: 'bg-purple-400' },
  slate:   { button: 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 border-slate-500/20', badge: 'bg-slate-500/15 text-slate-300',   dot: 'bg-slate-400' },
  cyan:    { button: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/20',     badge: 'bg-cyan-500/15 text-cyan-300',     dot: 'bg-cyan-400' },
  orange:  { button: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border-orange-500/20', badge: 'bg-orange-500/15 text-orange-300', dot: 'bg-orange-400' },
}

interface WidgetButton {
  id: string
  label: string
  icon: string
  color: string
  action_slug: string
  static_params: Record<string, unknown>
  dynamic_params: string[]
  confirm: boolean
  read_only: boolean
  result_display: 'toast' | 'inline' | 'none'
}

interface Widget {
  id: string
  name: string
  description?: string
  buttons: WidgetButton[]
  created_at: string
}

interface ButtonRunState {
  state: 'idle' | 'filling' | 'running' | 'done' | 'error'
  dynamicValues: Record<string, string>
  result?: unknown
  error?: string
}

interface Props {
  connectionId: string
  connectorName: string
  isAdmin: boolean
}

function WidgetButtonControl({
  btn, connectionId,
}: { btn: WidgetButton; connectionId: string }) {
  const [run, setRun] = useState<ButtonRunState>({ state: 'idle', dynamicValues: {} })
  const styles = COLOR_STYLES[btn.color] ?? COLOR_STYLES.slate
  const Icon = ICON_MAP[btn.icon] ?? Zap

  async function execute(extra: Record<string, string> = {}) {
    if (!btn.read_only && btn.confirm) {
      if (!confirm(`Run "${btn.label}"?`)) return
    }
    setRun(r => ({ ...r, state: 'running' }))
    const params = { ...btn.static_params, ...extra }
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, actionSlug: btn.action_slug, params }),
    })
    const data = await res.json()
    if (data.ok) {
      setRun(r => ({ ...r, state: 'done', result: data.data ?? data }))
    } else {
      setRun(r => ({ ...r, state: 'error', error: data.error ?? 'Failed' }))
    }
    if (btn.result_display !== 'inline') {
      setTimeout(() => setRun({ state: 'idle', dynamicValues: {} }), 2500)
    }
  }

  function handleClick() {
    if (btn.dynamic_params.length > 0 && run.state === 'idle') {
      setRun(r => ({ ...r, state: 'filling' }))
      return
    }
    if (btn.dynamic_params.length > 0 && run.state === 'filling') {
      execute(run.dynamicValues)
      return
    }
    execute()
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={run.state === 'running'}
        className={cn(
          'w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3.5 transition-all duration-150 disabled:opacity-60',
          styles.button,
          run.state === 'done' && 'border-emerald-500/40 bg-emerald-500/10',
          run.state === 'error' && 'border-red-500/40 bg-red-500/10',
        )}
      >
        <div className="flex items-center gap-2">
          {run.state === 'running' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : run.state === 'done' ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : run.state === 'error' ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
          <span className="text-xs font-semibold">
            {run.state === 'running' ? 'Running…' :
             run.state === 'done' ? 'Done' :
             run.state === 'error' ? 'Error' :
             run.state === 'filling' ? 'Confirm' :
             btn.label}
          </span>
        </div>
        {!btn.read_only && run.state === 'idle' && (
          <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', styles.badge)}>
            {btn.confirm ? 'WRITE · CONFIRM' : 'WRITE'}
          </span>
        )}
      </button>

      {/* Inline dynamic param form */}
      {run.state === 'filling' && btn.dynamic_params.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          {btn.dynamic_params.map(key => (
            <div key={key}>
              <label className="text-[10px] font-mono text-muted-foreground">{key}</label>
              <input
                value={run.dynamicValues[key] ?? ''}
                onChange={e => setRun(r => ({ ...r, dynamicValues: { ...r.dynamicValues, [key]: e.target.value } }))}
                onKeyDown={e => e.key === 'Enter' && execute(run.dynamicValues)}
                placeholder={key}
                className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mt-0.5"
                autoFocus
              />
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => execute(run.dynamicValues)}
              className="flex-1 py-1 rounded bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              Run
            </button>
            <button
              onClick={() => setRun({ state: 'idle', dynamicValues: {} })}
              className="px-2 py-1 rounded border border-border text-[11px] hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Inline result */}
      {run.state === 'done' && btn.result_display === 'inline' && run.result != null ? (
        <div className="rounded-lg bg-muted/30 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-emerald-400">Result</span>
            <button onClick={() => setRun({ state: 'idle', dynamicValues: {} })} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <pre className="text-[10px] font-mono overflow-auto max-h-28 text-foreground/80 whitespace-pre-wrap break-all">
            {JSON.stringify(run.result as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Error */}
      {run.state === 'error' && (
        <p className="text-[10px] text-red-400 px-1">{run.error}</p>
      )}
    </div>
  )
}

function WidgetCard({ widget, connectionId, onDelete }: { widget: Widget; connectionId: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{widget.name}</p>
          {widget.description && <p className="text-xs text-muted-foreground truncate">{widget.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {confirming ? (
            <>
              <button onClick={onDelete} className="text-[11px] text-red-400 hover:text-red-300 font-medium px-1.5 py-0.5 transition-colors">Delete</button>
              <button onClick={() => setConfirming(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 transition-colors">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className={cn(
          'grid gap-2',
          widget.buttons.length === 1 ? 'grid-cols-1' :
          widget.buttons.length === 2 ? 'grid-cols-2' :
          widget.buttons.length <= 4 ? 'grid-cols-2' :
          'grid-cols-3',
        )}>
          {widget.buttons.map(btn => (
            <WidgetButtonControl key={btn.id} btn={btn} connectionId={connectionId} />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SuggestedButton extends WidgetButton {}
interface Suggestion {
  name: string
  description: string
  buttons: SuggestedButton[]
}

function WizardPanel({ connectionId, connectorName, onSave, onClose }: {
  connectionId: string; connectorName: string; onSave: (w: Widget) => void; onClose: () => void
}) {
  const [step, setStep] = useState<'generating' | 'pick' | 'name' | 'saving'>('generating')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const [customName, setCustomName] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const generated = useRef(false)

  async function generate(prompt?: string) {
    setStep('generating')
    setError(null)
    generated.current = true
    const res = await fetch(`/api/connections/${connectionId}/widgets/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to generate suggestions'); setStep('pick'); return }
    setSuggestions(data)
    setStep('pick')
  }

  useEffect(() => {
    if (!generated.current) generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!selected) return
    setStep('saving')
    const name = customName.trim() || selected.name
    const res = await fetch(`/api/connections/${connectionId}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: selected.description, buttons: selected.buttons }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setStep('name'); return }
    onSave(data)
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold">Widget Wizard</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {step === 'generating' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing {connectorName} actions…</p>
          </div>
        )}

        {step === 'saving' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Creating widget…</p>
          </div>
        )}

        {(step === 'pick' || step === 'name') && (
          <>
            {error && <p className="text-xs text-destructive">{error}</p>}

            {step === 'pick' && (
              <>
                <p className="text-xs text-muted-foreground">
                  AI analyzed your {connectorName} actions and designed these widget presets. Pick one to use as-is or customize it.
                </p>
                <div className="space-y-3">
                  {suggestions.map((s, i) => {
                    const isSelected = selected?.name === s.name
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelected(s); setCustomName(s.name); setStep('name') }}
                        className={cn(
                          'w-full text-left rounded-xl border p-3 transition-all',
                          isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {s.buttons.map(b => {
                            const styles = COLOR_STYLES[b.color] ?? COLOR_STYLES.slate
                            const Icon = ICON_MAP[b.icon] ?? Zap
                            return (
                              <div key={b.id} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium', styles.button)}>
                                <Icon className="h-3 w-3" />
                                {b.label}
                              </div>
                            )
                          })}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Custom prompt */}
                <div className="pt-2 space-y-2 border-t">
                  <p className="text-xs text-muted-foreground">Or describe what you need:</p>
                  <div className="flex gap-2">
                    <input
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && customPrompt.trim() && generate(customPrompt)}
                      placeholder="e.g. A quick-response panel for SOC analysts"
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <button
                      onClick={() => generate(customPrompt)}
                      disabled={!customPrompt.trim()}
                      className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 'name' && selected && (
              <>
                <button
                  onClick={() => setStep('pick')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  ← Back to suggestions
                </button>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Widget name</label>
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Buttons ({selected.buttons.length})</p>
                  <div className={cn(
                    'grid gap-1.5',
                    selected.buttons.length <= 2 ? 'grid-cols-2' : 'grid-cols-3',
                  )}>
                    {selected.buttons.map(b => {
                      const styles = COLOR_STYLES[b.color] ?? COLOR_STYLES.slate
                      const Icon = ICON_MAP[b.icon] ?? Zap
                      return (
                        <div key={b.id} className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium', styles.button)}>
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate">{b.label}</p>
                            {b.dynamic_params.length > 0 && (
                              <p className="text-[9px] opacity-60">needs: {b.dynamic_params.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={save}
                    disabled={!customName.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    Create Widget
                  </button>
                  <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function WidgetBoard({ connectionId, connectorName, isAdmin }: Props) {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    fetch(`/api/connections/${connectionId}/widgets`)
      .then(r => r.json())
      .then(data => { setWidgets(data); setLoading(false) })
  }, [connectionId])

  async function deleteWidget(id: string) {
    await fetch(`/api/connections/${connectionId}/widgets/${id}`, { method: 'DELETE' })
    setWidgets(ws => ws.filter(w => w.id !== id))
  }

  function handleSaved(w: Widget) {
    setWidgets(ws => [...ws, w])
    setShowWizard(false)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Widgets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One-click control panels that make common {connectorName} actions accessible without typing commands.
          </p>
        </div>
        {isAdmin && !showWizard && (
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold border border-primary/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Create Widget
          </button>
        )}
      </div>

      {showWizard && (
        <WizardPanel
          connectionId={connectionId}
          connectorName={connectorName}
          onSave={handleSaved}
          onClose={() => setShowWizard(false)}
        />
      )}

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : widgets.length === 0 && !showWizard ? (
        <div className="py-10 text-center border border-dashed rounded-2xl space-y-2">
          <div className="h-10 w-10 rounded-xl bg-muted mx-auto flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No widgets yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Widgets let you execute common {connectorName} actions with a single click — no typing required.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowWizard(true)}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all mx-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first widget
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {widgets.map(w => (
            <WidgetCard
              key={w.id}
              widget={w}
              connectionId={connectionId}
              onDelete={() => deleteWidget(w.id)}
            />
          ))}
          {isAdmin && widgets.length > 0 && !showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another widget
            </button>
          )}
        </div>
      )}
    </section>
  )
}

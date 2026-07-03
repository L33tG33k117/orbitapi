'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Play, Save, Copy, Check, ChevronDown, ChevronRight,
  AlertTriangle, Terminal, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface RunRecord {
  id: string
  action: string
  input: string
  ok: boolean
  result: unknown
  durationMs: number
  timestamp: string
}

interface SavedQuery {
  id: string
  name: string
  input: string
  action: string
}

const RISK_COLORS = {
  read: 'text-emerald-400 bg-emerald-500/10',
  write: 'text-amber-400 bg-amber-500/10',
  destructive: 'text-red-400 bg-red-500/10',
}

function buildTemplate(action: ActionDef): string {
  const lines: string[] = [`${action.slug}`]
  if (action.params.length === 0) {
    lines.push('{}')
  } else {
    lines.push('{')
    action.params.forEach((p, i) => {
      const comma = i < action.params.length - 1 ? ',' : ''
      const val = p.enum ? `"${p.enum[0]}"` : p.type === 'integer' || p.type === 'number' ? '0' : '""'
      const comment = p.description ? `  // ${p.description}` : ''
      lines.push(`  "${p.key}": ${val}${comma}${comment}`)
    })
    lines.push('}')
  }
  return lines.join('\n')
}

function parseInput(input: string): { action: string; params: Record<string, unknown> } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const lines = trimmed.split('\n')
  const firstLine = lines[0].trim()

  // If first line looks like an action slug (no spaces, no braces)
  if (firstLine && !firstLine.startsWith('{') && !firstLine.includes(' ')) {
    const rest = lines.slice(1).join('\n').trim()
    let params: Record<string, unknown> = {}
    if (rest) {
      // Strip comments
      const stripped = rest.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
      try { params = JSON.parse(stripped) } catch { return null }
    }
    return { action: firstLine, params }
  }

  // Pure JSON with action key
  const stripped = trimmed.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>
    const { action, ...params } = obj
    if (typeof action === 'string') return { action, params }
  } catch { /* ignore */ }

  return null
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span style="color:#7dd3fc">${match}</span>`
        return `<span style="color:#86efac">${match}</span>`
      }
      if (/true|false/.test(match)) return `<span style="color:#f0abfc">${match}</span>`
      if (/null/.test(match)) return `<span style="color:#94a3b8">${match}</span>`
      return `<span style="color:#fbbf24">${match}</span>`
    })
}

interface Props {
  connectionId: string
  connectionLabel: string
  connectorSlug: string
  connectorName: string
  connectorCategory: string
  status: string
  actions: ActionDef[]
  onSimple?: () => void
}

export function ManualClient({ connectionId, connectionLabel, connectorSlug, connectorName, connectorCategory, status, actions, onSimple }: Props) {
  const historyKey = `orbit_hist_${connectionId}`
  const savedKey = `orbit_saved_${connectionId}`

  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ raw: unknown; ok: boolean; durationMs: number; action: string } | null>(null)
  const [history, setHistory] = useState<RunRecord[]>([])
  const [saved, setSaved] = useState<SavedQuery[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [copied, setCopied] = useState(false)
  const [expandedAction, setExpandedAction] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'commands' | 'history' | 'saved'>('commands')
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const h = localStorage.getItem(historyKey)
      if (h) setHistory(JSON.parse(h))
      const s = localStorage.getItem(savedKey)
      if (s) setSaved(JSON.parse(s))
    } catch { /* ignore */ }
  }, [historyKey, savedKey])

  function saveHistory(records: RunRecord[]) {
    const trimmed = records.slice(0, 100)
    setHistory(trimmed)
    localStorage.setItem(historyKey, JSON.stringify(trimmed))
  }

  function saveSaved(queries: SavedQuery[]) {
    setSaved(queries)
    localStorage.setItem(savedKey, JSON.stringify(queries))
  }

  async function run() {
    const parsed = parseInput(input)
    if (!parsed) { setError('Invalid format. First line should be an action slug, followed by a JSON params object.'); return }
    setError(null)
    setRunning(true)

    const start = Date.now()
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, actionSlug: parsed.action, params: parsed.params }),
    })
    const data = await res.json()
    const durationMs = Date.now() - start

    const record: RunRecord = {
      id: crypto.randomUUID(),
      action: parsed.action,
      input,
      ok: data.ok,
      result: data,
      durationMs,
      timestamp: new Date().toISOString(),
    }
    saveHistory([record, ...history])
    setResult({ raw: data, ok: data.ok, durationMs, action: parsed.action })
    setRunning(false)
    setHistIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      const t = e.currentTarget
      const start = t.selectionStart; const end = t.selectionEnd
      const next = input.substring(0, start) + '  ' + input.substring(end)
      setInput(next)
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = start + 2 })
      return
    }
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault()
      const next = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(next)
      if (history[next]) setInput(history[next].input)
      return
    }
    if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault()
      const next = Math.max(histIdx - 1, -1)
      setHistIdx(next)
      if (next === -1) setInput('')
      else if (history[next]) setInput(history[next].input)
    }
  }

  function fillAction(action: ActionDef) {
    setInput(buildTemplate(action))
    textareaRef.current?.focus()
  }

  function copyResult() {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result.raw, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function doSave() {
    const parsed = parseInput(input)
    if (!parsed) return
    const q: SavedQuery = { id: crypto.randomUUID(), name: saveName || parsed.action, input, action: parsed.action }
    saveSaved([q, ...saved])
    setSaveModal(false)
    setSaveName('')
  }

  function deleteHistory(id: string) {
    saveHistory(history.filter(h => h.id !== id))
  }

  function deleteSaved(id: string) {
    saveSaved(saved.filter(s => s.id !== id))
  }

  const resultJSON = result ? JSON.stringify(result.raw, null, 2) : ''

  const readActions = actions.filter(a => a.risk === 'read')
  const writeActions = actions.filter(a => a.risk === 'write')
  const destructiveActions = actions.filter(a => a.risk === 'destructive')

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <Link href={`/connectors/${connectionId}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{connectionLabel}</span>
          <span className="text-xs text-muted-foreground">{connectorName} · {connectorCategory}</span>
        </div>
        {onSimple && (
          <button onClick={onSimple} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md border px-2 py-1 transition-colors">
            ← Simple mode
          </button>
        )}
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
          !onSimple && 'ml-auto',
          status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
        )}>
          <div className={cn('h-1.5 w-1.5 rounded-full', status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground')} />
          {status}
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+↵</kbd>
          <span>to run</span>
          <span className="mx-1">·</span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Alt+↑↓</kbd>
          <span>history</span>
          <span className="mx-1">·</span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Tab</kbd>
          <span>indent</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: commands / history / saved */}
        <div className="w-[240px] shrink-0 flex flex-col border-r bg-[hsl(var(--sidebar))] overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b shrink-0">
            {(['commands', 'history', 'saved'] as const).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={cn(
                  'flex-1 py-2 text-[11px] font-semibold capitalize transition-colors',
                  activePanel === p ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p === 'commands' ? 'Commands' : p === 'history' ? `History${history.length ? ` (${history.length})` : ''}` : `Saved${saved.length ? ` (${saved.length})` : ''}`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Commands panel */}
            {activePanel === 'commands' && (
              <div className="p-2 space-y-3">
                {[
                  { label: 'READ', actions: readActions, color: 'text-emerald-400' },
                  { label: 'WRITE', actions: writeActions, color: 'text-amber-400' },
                  { label: 'DESTRUCTIVE', actions: destructiveActions, color: 'text-red-400' },
                ].filter(g => g.actions.length > 0).map(group => (
                  <div key={group.label}>
                    <p className={cn('px-2 pt-1 pb-1.5 text-[10px] font-bold tracking-widest', group.color)}>
                      {group.label} ({group.actions.length})
                    </p>
                    {group.actions.map(a => (
                      <div key={a.slug}>
                        <button
                          onClick={() => { fillAction(a); setExpandedAction(expandedAction === a.slug ? null : a.slug) }}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left hover:bg-muted/40 transition-colors group"
                        >
                          {expandedAction === a.slug
                            ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono font-medium truncate">{a.slug}</p>
                            <p className="text-[11px] text-muted-foreground truncate leading-tight">{a.name}</p>
                          </div>
                        </button>
                        {expandedAction === a.slug && (
                          <div className="mx-2 mb-2 rounded-lg border border-border/50 bg-muted/10 p-2 space-y-1.5">
                            <p className="text-[11px] text-muted-foreground leading-snug">{a.description}</p>
                            {a.params.length > 0 && (
                              <div className="space-y-1">
                                {a.params.map(p => (
                                  <div key={p.key} className="flex items-baseline gap-1.5">
                                    <code className="text-[10px] font-mono text-primary shrink-0">{p.key}</code>
                                    <span className="text-[10px] text-muted-foreground">{p.type}</span>
                                    {p.required && <span className="text-[10px] text-red-400">*</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => fillAction(a)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              ↳ Fill template
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* History panel */}
            {activePanel === 'history' && (
              <div className="p-2 space-y-1">
                {history.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-4 text-center">No queries yet</p>
                )}
                {history.map(h => (
                  <div key={h.id} className="group flex items-start gap-1.5 rounded hover:bg-muted/30 px-2 py-1.5 transition-colors">
                    <button
                      onClick={() => setInput(h.input)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', h.ok ? 'bg-emerald-400' : 'bg-red-400')} />
                        <p className="text-xs font-mono truncate">{h.action}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(h.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        {' · '}{h.durationMs}ms
                      </p>
                    </button>
                    <button
                      onClick={() => deleteHistory(h.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {history.length > 0 && (
                  <button
                    onClick={() => saveHistory([])}
                    className="w-full mt-2 text-[10px] text-muted-foreground hover:text-destructive text-center py-1 transition-colors"
                  >
                    Clear all history
                  </button>
                )}
              </div>
            )}

            {/* Saved panel */}
            {activePanel === 'saved' && (
              <div className="p-2 space-y-1">
                {saved.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-4 text-center">No saved queries.<br />Run a command, then click Save.</p>
                )}
                {saved.map(s => (
                  <div key={s.id} className="group flex items-start gap-1.5 rounded hover:bg-muted/30 px-2 py-1.5 transition-colors">
                    <button onClick={() => setInput(s.input)} className="flex-1 text-left min-w-0">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{s.action}</p>
                    </button>
                    <button
                      onClick={() => deleteSaved(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: terminal + output */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Terminal input */}
          <div className="flex flex-col border-b" style={{ height: '55%' }}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d1117] border-b border-[#21262d] shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[11px] text-[#8b949e] font-mono ml-2">{connectionLabel} · manual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setInput(''); textareaRef.current?.focus() }}
                  className="text-[11px] text-[#8b949e] hover:text-[#c9d1d9] px-1.5 py-0.5 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => { setSaveModal(true); setSaveName(parseInput(input)?.action ?? '') }}
                  disabled={!input.trim()}
                  className="flex items-center gap-1 text-[11px] text-[#8b949e] hover:text-[#c9d1d9] px-1.5 py-0.5 rounded transition-colors disabled:opacity-40"
                >
                  <Save className="h-3 w-3" />
                  Save
                </button>
              </div>
            </div>
            <div className="flex-1 relative bg-[#0d1117] overflow-hidden">
              <div className="absolute left-3 top-3 font-mono text-[#8b949e] text-xs select-none pointer-events-none">$</div>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`send_message\n{\n  "channel": "#alerts",\n  "text": "Hello from OrbitAPI"\n}\n\n// Alt+↑↓ for history  ·  Ctrl+Enter to run  ·  Tab to indent`}
                className="absolute inset-0 w-full h-full resize-none bg-transparent text-[13px] font-mono text-[#c9d1d9] placeholder:text-[#484f58] outline-none pl-7 pr-3 pt-3 pb-3 leading-relaxed"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-t border-[#21262d] shrink-0">
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 flex-1 mr-2">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {error}
                </div>
              )}
              {!error && <div className="flex-1" />}
              <button
                onClick={run}
                disabled={running || !input.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Play className="h-3 w-3" />
                {running ? 'Running…' : 'Run'}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#21262d] bg-[#161b22] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#8b949e]">Output</span>
                {result && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                    result.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  )}>
                    {result.ok ? '✓ Success' : '✗ Error'}
                  </span>
                )}
                {result && (
                  <span className="text-[10px] text-[#8b949e]">{result.durationMs}ms</span>
                )}
              </div>
              {result && result.ok && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyResult}
                    className="flex items-center gap-1 text-[11px] text-[#8b949e] hover:text-[#c9d1d9] px-1.5 py-0.5 rounded transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <ResultExport data={result.raw} baseName={`${connectorSlug}_${result.action}`} variant="compact" className="!text-[#8b949e] hover:!text-[#c9d1d9]" />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              {!result && (
                <div className="flex flex-col items-center justify-center h-full space-y-2 text-center">
                  <Terminal className="h-8 w-8 text-[#484f58]" />
                  <p className="text-sm text-[#484f58] font-mono">
                    Select a command from the left, edit params, then run.
                  </p>
                </div>
              )}
              {result && (
                <pre
                  className="text-[12px] font-mono leading-relaxed text-[#c9d1d9] whitespace-pre-wrap break-all"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlight(resultJSON) }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save modal */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-5 w-80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Save query</p>
              <button onClick={() => setSaveModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSave()}
              placeholder="Query name…"
              autoFocus
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={doSave}
                disabled={!saveName.trim()}
                className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setSaveModal(false)}
                className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

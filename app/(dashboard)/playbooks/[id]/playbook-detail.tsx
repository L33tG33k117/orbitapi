'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Play, Trash2, Plus, ChevronDown, ChevronUp, ArrowLeft, Gauge, GitBranch,
  Bot, Bell, Clock, ShieldCheck, Wrench, X, List, Network,
} from 'lucide-react'
import { PlaybookCanvas } from './playbook-canvas'

type NodeType = 'assess' | 'action' | 'condition' | 'approval' | 'notify' | 'wait'
interface PlaybookNode {
  id: string
  name: string
  type: NodeType
  connection_id?: string
  action_slug?: string
  prompt?: string
  expr?: string
  on_true?: string
  on_false?: string
  message?: string
  wait_seconds?: number
  wait_event?: string
  next?: string
  position?: { x: number; y: number }
}
interface Threshold { min: number; max: number; mode: 'auto' | 'approval' | 'notify' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = any
interface AvailableConn { connectionId: string; label: string; actions: { slug: string; name: string; risk: string }[] }

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playbook: any
  availableActions: AvailableConn[]
  runs: Run[]
  isAdmin: boolean
}

const NODE_META: Record<NodeType, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  assess:   { label: 'Assess', icon: Gauge, hint: 'AI reads data and scores confidence 0–10' },
  action:   { label: 'Action', icon: Wrench, hint: 'Run a connector action (gated by autonomy policy)' },
  condition:{ label: 'Condition', icon: GitBranch, hint: 'Branch on state, e.g. state.open > 0' },
  approval: { label: 'Approval', icon: ShieldCheck, hint: 'Pause for a human to approve' },
  notify:   { label: 'Notify', icon: Bell, hint: 'Send a notification, never writes' },
  wait:     { label: 'Wait', icon: Clock, hint: 'Pause for a timer or external event' },
}

export function PlaybookDetail({ playbook, availableActions, runs, isAdmin }: Props) {
  const router = useRouter()
  const [persona, setPersona] = useState<string>(playbook.persona ?? '')
  const [triggerType, setTriggerType] = useState<string>(playbook.trigger_type ?? 'manual')
  const [schedule, setSchedule] = useState<string>(playbook.schedule ?? '')
  const [enabled, setEnabled] = useState<boolean>(playbook.enabled ?? false)
  const [steps, setSteps] = useState<PlaybookNode[]>(playbook.definition?.steps ?? [])
  const [thresholds, setThresholds] = useState<Threshold[]>(
    playbook.autonomy_policy?.thresholds ?? [
      { min: 9, max: 10, mode: 'auto' }, { min: 6, max: 8, mode: 'approval' }, { min: 0, max: 5, mode: 'notify' },
    ]
  )
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<'list' | 'canvas'>('list')

  function patchStep(i: number, patch: Partial<PlaybookNode>) {
    setSteps(s => s.map((n, idx) => idx === i ? { ...n, ...patch } : n))
  }
  function addStep(type: NodeType) {
    const id = `${type}_${Date.now().toString(36)}`
    setSteps(s => [...s, { id, name: NODE_META[type].label, type }])
  }
  function removeStep(i: number) { setSteps(s => s.filter((_, idx) => idx !== i)) }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps(s => {
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const copy = [...s]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy
    })
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/playbooks/${playbook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona, trigger_type: triggerType, schedule: schedule || null, enabled,
        definition: { steps }, autonomy_policy: { thresholds },
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Save failed'); return }
    toast.success('Playbook saved')
    router.refresh()
  }

  async function run(mode: 'dry_run' | 'live') {
    setRunning(true)
    const res = await fetch(`/api/playbooks/${playbook.id}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
    })
    const data = await res.json()
    setRunning(false)
    if (!res.ok) { toast.error(data.error ?? 'Run failed'); return }
    toast.success(data.status === 'waiting' ? 'Run started — paused awaiting approval' : `Run ${data.status}`)
    router.refresh()
  }

  async function remove() {
    if (!confirm('Delete this playbook? Run history is removed too.')) return
    const res = await fetch(`/api/playbooks/${playbook.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Playbook deleted'); router.push('/playbooks') }
    else toast.error('Delete failed')
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <Link href="/playbooks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Playbooks
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{playbook.name}</h1>
          {playbook.description && <p className="text-muted-foreground mt-1">{playbook.description}</p>}
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => run('dry_run')} disabled={running}>
              <Play className="h-3.5 w-3.5" /> Dry run
            </Button>
            <Button size="sm" onClick={() => run('live')} disabled={running}>
              <Play className="h-3.5 w-3.5" /> Run live
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          {/* Config */}
          <section className="border rounded-xl p-4 bg-card space-y-4">
            <h2 className="font-medium text-sm">Configuration</h2>
            <div className="space-y-1.5">
              <Label htmlFor="persona">Persona</Label>
              <textarea id="persona" value={persona} onChange={e => setPersona(e.target.value)} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="You are a security operations analyst…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="trigger">Trigger</Label>
                <select id="trigger" value={triggerType} onChange={e => setTriggerType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="manual">Manual</option>
                  <option value="schedule">Schedule</option>
                  <option value="webhook">Webhook</option>
                  <option value="event">Event</option>
                </select>
              </div>
              {triggerType === 'schedule' && (
                <div className="space-y-1.5">
                  <Label htmlFor="sched">Cron schedule</Label>
                  <Input id="sched" value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="0 * * * *" />
                </div>
              )}
            </div>
            {(triggerType === 'webhook' || triggerType === 'event') && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">Where do I get the webhook URL &amp; signing key?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {triggerType === 'webhook' ? 'Webhook' : 'Event'} triggers are set up on the <span className="font-medium text-foreground">Webhooks</span> page.
                  Create an endpoint there that targets this playbook — it gives you the URL and the signing secret (sent as the <code className="text-[11px]">X-Orbit-Signature</code> header).
                </p>
                <a href="/webhooks" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-2">
                  Open Webhooks →
                </a>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Enabled (scheduled/webhook triggers only fire when on)
            </label>
          </section>

          {/* Autonomy policy */}
          <section className="border rounded-xl p-4 bg-card space-y-3">
            <div>
              <h2 className="font-medium text-sm">Autonomy policy</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                How write actions behave at a given confidence level. This is what lets one playbook auto-act
                when the AI is highly confident while requiring approval when it&apos;s uncertain.
              </p>
            </div>
            {thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-16">Confidence</span>
                <Input type="number" min={0} max={10} value={t.min} className="w-16"
                  onChange={e => setThresholds(ts => ts.map((x, idx) => idx === i ? { ...x, min: Number(e.target.value) } : x))} />
                <span className="text-muted-foreground">to</span>
                <Input type="number" min={0} max={10} value={t.max} className="w-16"
                  onChange={e => setThresholds(ts => ts.map((x, idx) => idx === i ? { ...x, max: Number(e.target.value) } : x))} />
                <span className="text-muted-foreground">→</span>
                <select value={t.mode}
                  onChange={e => setThresholds(ts => ts.map((x, idx) => idx === i ? { ...x, mode: e.target.value as Threshold['mode'] } : x))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="auto">Auto-execute</option>
                  <option value="approval">Require approval</option>
                  <option value="notify">Notify only</option>
                </select>
              </div>
            ))}
          </section>

          {/* Step editor */}
          <section className="border rounded-xl p-4 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm">Steps</h2>
              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                <button onClick={() => setView('list')} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <List className="h-3.5 w-3.5" /> List
                </button>
                <button onClick={() => setView('canvas')} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'canvas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Network className="h-3.5 w-3.5" /> Canvas
                </button>
              </div>
            </div>

            {view === 'canvas' ? (
              <PlaybookCanvas
                steps={steps}
                onChange={s => setSteps(s as PlaybookNode[])}
                availableActions={availableActions}
              />
            ) : (
            <>
            {availableActions.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                This playbook&apos;s group has no active connections — action steps won&apos;t have anything to call.
              </p>
            )}
            {steps.length === 0 && <p className="text-xs text-muted-foreground">No steps yet. Add one below.</p>}

            {steps.map((node, i) => {
              const Meta = NODE_META[node.type]
              const Icon = Meta.icon
              const conn = availableActions.find(a => a.connectionId === node.connection_id)
              return (
                <div key={node.id} className="border rounded-lg p-3 bg-background space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-16">{Meta.label}</span>
                    <Input value={node.name} onChange={e => patchStep(i, { name: e.target.value })} className="flex-1 h-7" />
                    <Button variant="ghost" size="icon-sm" onClick={() => moveStep(i, -1)} disabled={i === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeStep(i)}><X className="h-3.5 w-3.5" /></Button>
                  </div>

                  {node.type === 'assess' && (
                    <textarea value={node.prompt ?? ''} onChange={e => patchStep(i, { prompt: e.target.value })} rows={2}
                      placeholder="What should the AI evaluate?" className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
                  )}

                  {node.type === 'action' && (
                    <div className="grid grid-cols-2 gap-2">
                      <select value={node.connection_id ?? ''} onChange={e => patchStep(i, { connection_id: e.target.value, action_slug: '' })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="">Connection…</option>
                        {availableActions.map(a => <option key={a.connectionId} value={a.connectionId}>{a.label}</option>)}
                      </select>
                      <select value={node.action_slug ?? ''} onChange={e => patchStep(i, { action_slug: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm" disabled={!conn}>
                        <option value="">Action…</option>
                        {(conn?.actions ?? []).map(act => (
                          <option key={act.slug} value={act.slug}>{act.name}{act.risk !== 'read' ? ` (${act.risk})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {node.type === 'condition' && (
                    <div className="space-y-2">
                      <Input value={node.expr ?? ''} onChange={e => patchStep(i, { expr: e.target.value })} placeholder="state.open_detections > 0" className="h-8" />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <select value={node.on_true ?? ''} onChange={e => patchStep(i, { on_true: e.target.value })}
                          className="h-8 rounded-md border border-input bg-background px-2">
                          <option value="">if true → next step</option>
                          {steps.filter(s => s.id !== node.id).map(s => <option key={s.id} value={s.id}>true → {s.name}</option>)}
                        </select>
                        <select value={node.on_false ?? ''} onChange={e => patchStep(i, { on_false: e.target.value })}
                          className="h-8 rounded-md border border-input bg-background px-2">
                          <option value="">if false → end</option>
                          {steps.filter(s => s.id !== node.id).map(s => <option key={s.id} value={s.id}>false → {s.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {node.type === 'notify' && (
                    <Input value={node.message ?? ''} onChange={e => patchStep(i, { message: e.target.value })}
                      placeholder="Message — supports {{state.xyz}}" className="h-8" />
                  )}

                  {node.type === 'wait' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={node.wait_seconds ?? ''} onChange={e => patchStep(i, { wait_seconds: Number(e.target.value) || undefined })} placeholder="Seconds" className="h-8" />
                      <Input value={node.wait_event ?? ''} onChange={e => patchStep(i, { wait_event: e.target.value || undefined })} placeholder="…or event name" className="h-8" />
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">{Meta.hint}</p>
                </div>
              )
            })}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(NODE_META) as NodeType[]).map(t => {
                const Icon = NODE_META[t].icon
                return (
                  <Button key={t} variant="outline" size="xs" onClick={() => addStep(t)}>
                    <Plus className="h-3 w-3" /> <Icon className="h-3 w-3" /> {NODE_META[t].label}
                  </Button>
                )
              })}
            </div>
            </>
            )}
          </section>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save playbook'}</Button>
            <Button variant="destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          </div>
        </>
      )}

      {/* Runs */}
      <section className="space-y-2">
        <h2 className="font-medium text-sm">Recent runs</h2>
        {runs.length === 0 && <p className="text-xs text-muted-foreground">No runs yet.</p>}
        {runs.map(r => <RunRow key={r.id} run={r} />)}
      </section>
    </div>
  )
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false)
  const statusColor: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-500', running: 'bg-blue-500/10 text-blue-500',
    waiting: 'bg-amber-500/10 text-amber-500', failed: 'bg-red-500/10 text-red-500',
    cancelled: 'bg-muted text-muted-foreground',
  }
  return (
    <div className="border rounded-lg bg-card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColor[run.status] ?? 'bg-muted'}`}>{run.status}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs">
            {run.mode === 'dry_run' ? 'Dry run' : 'Live'} · {new Date(run.started_at).toLocaleString()}
            {run.severity != null && ` · confidence ${run.severity}`}
            {run.autonomy_decision && ` · ${run.autonomy_decision}`}
          </p>
          {run.summary && <p className="text-[11px] text-muted-foreground truncate">{run.summary}</p>}
        </div>
        {run.cost_usd > 0 && <span className="text-[11px] text-muted-foreground font-mono">${Number(run.cost_usd).toFixed(4)}</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t p-3 space-y-2">
          {(run.steps ?? []).map((s: Record<string, unknown>, i: number) => (
            <div key={i} className="text-xs flex items-start gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {String(s.tool_name ?? s.type)}
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">{String(s.status)}</span>
                  {s.autonomy ? <span className="ml-2 text-[10px] uppercase text-primary">{String(s.autonomy)}</span> : null}
                  {s.duration_ms ? <span className="ml-2 text-[10px] text-muted-foreground">{String(s.duration_ms)}ms</span> : null}
                </p>
                {s.note ? <p className="text-[11px] text-muted-foreground">{String(s.note)}</p> : null}
                {s.result != null && (
                  <pre className="mt-1 text-[10px] bg-muted/50 rounded p-1.5 overflow-x-auto max-h-32">{JSON.stringify(s.result, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
          {(run.steps ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">No steps recorded.</p>}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Lock, Gauge, Plug, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { DOW_OPTIONS, HOUR_OPTIONS, parseSchedule, buildSchedule } from '@/lib/schedules'
import { estimateRunCredits, runsPerMonth, scaleEstimate, formatEstimate, type Efficiency } from '@/lib/ai-estimate'

type Autonomy = 'supervised' | 'manual' | 'autonomous'

interface SkillData {
  id: string
  name: string
  description: string
  group_id: string
  persona: string
  blocked_slugs: string[]
  autonomy: Autonomy
  enabled: boolean
  schedule: string
  trigger_prompt: string
  webhook_secret: string | null
}

interface Action {
  slug: string
  name: string
  risk: string
  connection: string
}

interface Group { id: string; name: string; color: string }

// Active workspace connection, with the groups it belongs to (for live scoping).
export interface ConnInfo { id: string; label: string; name: string; slug: string; reads: number; writes: number; groupIds: string[] }

interface VerifyCheck { status: 'pass' | 'warn' | 'fail'; label: string; detail?: string }
interface VerifyReport {
  verdict: 'pass' | 'fail'
  summary: string
  checks: VerifyCheck[]
  connectors: { slug: string; name: string; label: string; reads: number; writes: number }[]
}

const AUTONOMY_OPTIONS: { value: Autonomy; label: string; description: string }[] = [
  {
    value: 'supervised',
    label: 'Supervised',
    description: 'Runs on a schedule and logs what it would do — writes are never executed. Safe for reviewing your workflow.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'You trigger it yourself. Reads and writes execute for real. Good for workflows you want full control over.',
  },
  {
    value: 'autonomous',
    label: 'Autonomous',
    description: 'Triggered by events and criteria — the AI acts when conditions are met, like a new booking or a sensor alert.',
  },
]

export function SkillEditor({
  skill,
  groups,
  availableActions,
  isAdmin,
  webhooksEnabled = true,
  automationEnabled = true,
  efficiency = 'balanced',
  connections = [],
}: {
  skill: SkillData
  groups: Group[]
  availableActions: Action[]
  isAdmin: boolean
  webhooksEnabled?: boolean
  automationEnabled?: boolean
  efficiency?: Efficiency
  connections?: ConnInfo[]
}) {
  const router = useRouter()
  const [form, setForm] = useState(skill)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webhookSecret, setWebhookSecret] = useState<string | null>(skill.webhook_secret)
  // Resolve origin after mount so SSR + first client render match (no hydration mismatch).
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const [webhookLoading, setWebhookLoading] = useState(false)

  // Parse schedule into DOW + hour for the pickers
  const parsedSchedule = form.schedule ? parseSchedule(form.schedule) : { dow: '*', hour: '8' }
  const [scheduleDow, setScheduleDow] = useState(parsedSchedule.dow)
  const [scheduleHour, setScheduleHour] = useState(parsedSchedule.hour)
  const [scheduleEnabled, setScheduleEnabled] = useState(!!form.schedule)

  // Skill Builder — verification gates Save (we don't ship broken skills).
  const [verifyState, setVerifyState] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle')
  const [verifyReport, setVerifyReport] = useState<VerifyReport | null>(null)

  // Connections this skill can use given the selected group (updates live).
  const scopedConnections = useMemo(
    () => form.group_id ? connections.filter(c => c.groupIds.includes(form.group_id)) : connections,
    [connections, form.group_id],
  )

  // Editing anything that affects behavior invalidates a prior verification.
  const VERIFY_KEYS: (keyof SkillData)[] = ['persona', 'trigger_prompt', 'group_id', 'blocked_slugs', 'autonomy']
  function set<K extends keyof SkillData>(key: K, value: SkillData[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
    if (VERIFY_KEYS.includes(key)) { setVerifyState('idle'); setVerifyReport(null) }
  }

  async function verify() {
    setVerifyState('running')
    try {
      const res = await fetch(`/api/skills/${skill.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: form.persona, trigger_prompt: form.trigger_prompt,
          group_id: form.group_id, blocked_slugs: form.blocked_slugs,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVerifyReport({ verdict: 'fail', summary: data.error ?? 'Verification failed.', checks: [], connectors: [] })
        setVerifyState('failed')
        return
      }
      setVerifyReport(data as VerifyReport)
      setVerifyState((data as VerifyReport).verdict === 'pass' ? 'passed' : 'failed')
    } catch {
      setVerifyReport({ verdict: 'fail', summary: 'Could not verify — please try again.', checks: [], connectors: [] })
      setVerifyState('failed')
    }
  }

  function handleDowChange(dow: string) {
    setScheduleDow(dow)
    if (scheduleEnabled) set('schedule', buildSchedule(dow, scheduleHour))
    setSaved(false)
  }

  function handleHourChange(hour: string) {
    setScheduleHour(hour)
    if (scheduleEnabled) set('schedule', buildSchedule(scheduleDow, hour))
    setSaved(false)
  }

  function handleScheduleToggle(enabled: boolean) {
    setScheduleEnabled(enabled)
    set('schedule', enabled ? buildSchedule(scheduleDow, scheduleHour) : '')
  }

  function toggleBlocked(slug: string) {
    set('blocked_slugs', form.blocked_slugs.includes(slug)
      ? form.blocked_slugs.filter(s => s !== slug)
      : [...form.blocked_slugs, slug]
    )
  }

  async function generateWebhook() {
    setWebhookLoading(true)
    const res = await fetch(`/api/skills/${skill.id}/webhook`, { method: 'POST' })
    if (res.ok) {
      const { webhook_secret } = await res.json()
      setWebhookSecret(webhook_secret)
    }
    setWebhookLoading(false)
  }

  async function revokeWebhook() {
    setWebhookLoading(true)
    await fetch(`/api/skills/${skill.id}/webhook`, { method: 'DELETE' })
    setWebhookSecret(null)
    setWebhookLoading(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/skills/${skill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Persona</p>
          <p className="text-sm whitespace-pre-wrap bg-muted rounded-lg p-3">{skill.persona || 'No persona defined.'}</p>
        </div>
        <p className="text-xs text-muted-foreground">Contact an admin to edit this skill.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Connectors this skill can use</Label>
          <select
            value={form.group_id}
            onChange={e => set('group_id', e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All my connections</option>
            {groups.map(g => <option key={g.id} value={g.id}>Only the “{g.name}” group</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Pick a <a href="/groups" className="underline underline-offset-2 hover:text-foreground">group</a> to limit
            this skill to specific connectors, or leave it on all connections.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="What this skill does in one sentence"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Persona</Label>
        <p className="text-xs text-muted-foreground">
          This is the AI&apos;s system prompt — its role, responsibilities, and how it should behave.
        </p>
        <textarea
          value={form.persona}
          onChange={e => set('persona', e.target.value)}
          rows={8}
          placeholder={`You are the Property Manager for Cabin A, an Airbnb vacation rental.\n\nYour responsibilities:\n- Check Lodgify daily for upcoming check-ins and check-outs\n- Turn lights on when guests check in, off when they check out\n- Send a welcome message to arriving guests\n- Alert the owner if anything looks wrong\n\nAlways check current bookings before taking any action. Be cautious with write operations.`}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Mode */}
      <div className="space-y-3">
        <Label>Mode</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AUTONOMY_OPTIONS.map(opt => {
            const locked = !automationEnabled && opt.value !== 'manual'
            return (
              <button
                key={opt.value}
                type="button"
                disabled={locked}
                title={locked ? 'Upgrade to unlock' : undefined}
                onClick={() => {
                  if (locked) return
                  set('autonomy', opt.value)
                  // Clear schedule when switching away from supervised
                  if (opt.value !== 'supervised') {
                    setScheduleEnabled(false)
                    set('schedule', '')
                  }
                }}
                className={`rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                  locked
                    ? 'border-dashed border-border text-muted-foreground/50 cursor-not-allowed'
                    : form.autonomy === opt.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <p className="font-medium flex items-center gap-1.5">
                  {opt.label}
                  {locked && <Lock className="h-3 w-3" />}
                </p>
                <p className="text-xs mt-0.5 opacity-70 leading-snug">{opt.description}</p>
              </button>
            )
          })}
        </div>
        {!automationEnabled && (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              On your plan, skills run <span className="font-medium text-foreground">manually</span>. Upgrade to run them on a
              schedule or fully autonomously.
            </p>
            <a href="/upgrade" className="text-xs font-medium text-primary hover:underline shrink-0">Upgrade →</a>
          </div>
        )}
      </div>

      {/* Schedule (supervised) / Poll interval (autonomous) — not shown for manual */}
      {form.autonomy !== 'manual' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="schedule-toggle"
              checked={scheduleEnabled}
              onChange={e => handleScheduleToggle(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="schedule-toggle" className="text-sm font-medium cursor-pointer">
              {form.autonomy === 'supervised' ? 'Run on a schedule' : 'Poll on a schedule'}
            </label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {form.autonomy === 'supervised'
              ? 'Dry-run at a fixed time — logs what it would do without executing writes.'
              : 'Check the trigger condition at a fixed interval. The AI evaluates current data and only acts if conditions are met — no wasted runs.'}
          </p>
          {scheduleEnabled && (
            <div className="flex items-center gap-3 pl-6">
              <select
                value={scheduleDow}
                onChange={e => handleDowChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {DOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="text-sm text-muted-foreground">at</span>
              <select
                value={scheduleHour}
                onChange={e => handleHourChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {HOUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!form.enabled && (
                <p className="text-xs text-amber-600">Enable this skill for the schedule to run.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Estimated AI Power — helps the user gauge ongoing cost before saving */}
      {(() => {
        const runEst = estimateRunCredits(efficiency)
        const scheduled = scheduleEnabled && form.autonomy !== 'manual'
        const monthly = scheduled ? scaleEstimate(runEst, runsPerMonth(scheduleDow)) : null
        return (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold">Estimated AI Power</p>
            </div>
            <p className="text-xs text-muted-foreground">
              About <span className="font-medium text-foreground">{formatEstimate(runEst)}</span> per run
              {scheduled && monthly
                ? <> · roughly <span className="font-medium text-foreground">{formatEstimate(monthly)} / month</span> at this schedule</>
                : form.autonomy === 'manual' ? ' — runs only when you trigger it' : null}.
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Rough estimate; actual usage depends on the task and how much data it reads. Track your balance on{' '}
              <a href="/ai-power" className="underline underline-offset-2 hover:text-foreground">AI Power</a>.
            </p>
          </div>
        )
      })()}

      {/* Trigger condition — autonomous only */}
      {form.autonomy === 'autonomous' && (
        <div className="space-y-1.5">
          <Label>Trigger condition</Label>
          <p className="text-xs text-muted-foreground">
            Describe what event or condition should cause this skill to act. The AI reads this when it runs to decide whether to proceed.
          </p>
          <textarea
            value={form.trigger_prompt}
            onChange={e => set('trigger_prompt', e.target.value)}
            rows={4}
            placeholder={`Examples:\n- A Ring doorbell event occurred — check if a Lodgify booking has check-in today and run the arrival workflow\n- A new booking was created in Lodgify — send a welcome message to the guest`}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Webhook trigger */}
      {form.autonomy === 'autonomous' && (
        <div className="space-y-2">
          <Label>Webhook trigger</Label>
          {!webhooksEnabled ? (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Webhook triggers are available on the <span className="font-medium text-foreground">Starter</span> plan and above.
              </p>
              <a href="/upgrade" className="text-xs font-medium text-primary hover:underline shrink-0">Upgrade →</a>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                External services (Lodgify, Ring, Zapier, etc.) can POST to this URL to fire this skill instantly.
              </p>
              {webhookSecret ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
                  <code className="block text-xs bg-background rounded px-2 py-1.5 border break-all select-all">
                    {origin}/api/webhooks/skills/{skill.id}?secret={webhookSecret}
                  </code>
                  <p className="text-xs text-muted-foreground">POST any JSON payload — it will be passed to the AI as context.</p>
                  <button
                    type="button"
                    onClick={revokeWebhook}
                    disabled={webhookLoading}
                    className="text-xs text-destructive underline underline-offset-2 hover:opacity-70"
                  >
                    {webhookLoading ? 'Revoking…' : 'Revoke webhook'}
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={generateWebhook} disabled={webhookLoading}>
                  {webhookLoading ? 'Generating…' : 'Generate webhook URL'}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Blocked actions */}
      {availableActions.length > 0 && (
        <div className="space-y-2">
          <div>
            <Label>Blocked actions</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              These actions can never run — even if the AI tries. Useful for preventing destructive operations.
            </p>
          </div>
          <div className="border rounded-lg divide-y">
            {availableActions.map(a => {
              const isBlocked = form.blocked_slugs.includes(a.slug)
              return (
                <label
                  key={a.slug}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={isBlocked}
                    onChange={() => toggleBlocked(a.slug)}
                    className="h-4 w-4 rounded accent-destructive"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{a.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">· {a.connection}</span>
                  </div>
                  <Badge
                    variant={a.risk === 'read' ? 'outline' : a.risk === 'write' ? 'secondary' : 'destructive'}
                    className="text-xs shrink-0"
                  >
                    {a.risk}
                  </Badge>
                  {isBlocked && <span className="text-xs text-destructive font-medium shrink-0">blocked</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => set('enabled', e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Enabled
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <div className="space-y-1.5">
        <Button onClick={save} disabled={saving || verifyState !== 'passed'}>
          {saving ? 'Saving…' : 'Save skill'}
        </Button>
        {verifyState !== 'passed' && (
          <p className="text-xs text-muted-foreground">
            {verifyState === 'failed'
              ? 'Resolve the issues in the Skill Builder, then verify again to save.'
              : 'Run “Verify skill” in the Skill Builder before saving.'}
          </p>
        )}
      </div>
      </div>

      {/* Skill Builder — available connectors + verification (gates Save) */}
      <aside className="lg:sticky lg:top-8 h-fit space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Skill Builder</h3>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Available connectors {form.group_id ? '(in this group)' : '(all connections)'}
          </p>
          {scopedConnections.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-500">
              No connectors available{form.group_id ? ' in this group' : ''}. This skill can&apos;t do anything until you connect one or pick a different group.
            </div>
          ) : (
            <div className="space-y-1.5">
              {scopedConnections.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{c.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.reads}r · {c.writes}w</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={verify}
          disabled={verifyState === 'running'}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2 hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {verifyState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {verifyState === 'running' ? 'Verifying…' : verifyState === 'passed' ? 'Verified — re-check' : 'Verify skill'}
        </button>

        {verifyReport && (
          <div className="space-y-2">
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${
              verifyReport.verdict === 'pass'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {verifyReport.summary}
            </div>
            {verifyReport.checks.length > 0 && (
              <ul className="space-y-1.5">
                {verifyReport.checks.map((c, i) => {
                  const Icon = c.status === 'pass' ? CheckCircle2 : c.status === 'warn' ? AlertTriangle : XCircle
                  const color = c.status === 'pass' ? 'text-emerald-400' : c.status === 'warn' ? 'text-amber-400' : 'text-red-400'
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
                      <div className="min-w-0">
                        <p className="font-medium">{c.label}</p>
                        {c.detail && <p className="text-muted-foreground leading-snug">{c.detail}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          Verification confirms the connectors this skill needs are connected and the logic holds up. A skill must pass before it can be saved.
        </p>
      </aside>
    </div>
  )
}

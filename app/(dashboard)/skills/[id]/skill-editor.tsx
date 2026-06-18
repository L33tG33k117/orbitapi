'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { DOW_OPTIONS, HOUR_OPTIONS, parseSchedule, buildSchedule } from '@/lib/schedules'

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
}: {
  skill: SkillData
  groups: Group[]
  availableActions: Action[]
  isAdmin: boolean
  webhooksEnabled?: boolean
  automationEnabled?: boolean
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

  function set<K extends keyof SkillData>(key: K, value: SkillData[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
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
    <div className="space-y-6">
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

      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save skill'}
      </Button>
    </div>
  )
}

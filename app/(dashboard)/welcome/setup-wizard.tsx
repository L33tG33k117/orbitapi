'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, Bell, Check, ArrowRight, Sparkles, Loader2, Zap, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Two zero-config simulated connectors the wizard can spin up instantly — no API
// keys, real demo data. Each carries the persona for the starter skill so step 2
// always produces a skill that actually matches what was connected in step 1.
const STARTERS = [
  {
    slug: 'simulated-lights',
    label: 'Smart Lights',
    icon: Lightbulb,
    blurb: 'A set of simulated smart lights you can read and control.',
    persona:
      'You are a smart-home assistant managing simulated smart lights. When run, list every light device and report each one’s current state — on/off, brightness, and color — then summarize clearly. This is a read-only status check; do not change any device.',
  },
  {
    slug: 'simulated-ring',
    label: 'Video Doorbell',
    icon: Bell,
    blurb: 'A simulated video doorbell with motion and ring events.',
    persona:
      'You are a smart-home assistant monitoring a simulated video doorbell. When run, list the devices and summarize the most recent events. This is a read-only status check; do not change anything.',
  },
] as const

type Starter = (typeof STARTERS)[number]

const STEPS = ['Connect a tool', 'Create a skill', 'Run it once'] as const

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0) // 0,1,2
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [starter, setStarter] = useState<Starter | null>(null)
  const [skillId, setSkillId] = useState<string | null>(null)
  const [ran, setRan] = useState(false)

  async function connect(s: Starter) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorSlug: s.slug,
          label: `${s.label} (demo)`,
          credentials: {},
          isSimulated: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message ?? data.error ?? 'Could not connect.'); return }
      setStarter(s)
      setStep(1)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function createSkill() {
    if (!starter) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `My first skill — ${starter.label}`,
          description: `A read-only starter skill that checks your ${starter.label.toLowerCase()}.`,
          persona: starter.persona,
          autonomy: 'manual',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message ?? data.error ?? 'Could not create the skill.'); return }
      setSkillId(data.id)
      setStep(2)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function runSkill() {
    if (!skillId) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/skills/${skillId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'live' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message ?? data.error ?? 'The run failed.'); return }
      setRan(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-6">
      <div className="text-center space-y-2 mb-8">
        <div className="mx-auto h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Let&apos;s get you to your first result</h1>
        <p className="text-muted-foreground text-sm">
          Three quick steps, all on demo data — no API keys needed. Takes about a minute.
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const done = i < step || (i === 2 && ran)
          const active = i === step && !(i === 2 && ran)
          return (
            <li key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                done ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : active ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
              }`}>
                <span className={`flex items-center justify-center h-4 w-4 rounded-full text-[10px] ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {label}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </li>
          )
        })}
      </ol>

      <div className="rounded-2xl border bg-card p-6">
        {/* Step 1 — connect */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Connect a tool</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pick a simulated app to start with. It spins up instantly with realistic demo data.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {STARTERS.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.slug}
                    onClick={() => connect(s)}
                    disabled={busy}
                    className="text-left rounded-xl border p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    <Icon className="h-5 w-5 text-primary mb-2" />
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.blurb}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2 — create skill */}
        {step === 1 && starter && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Create your first skill</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              A <span className="font-medium text-foreground">skill</span> is a reusable AI agent with a job.
              We&apos;ll set up a read-only one that checks your <span className="font-medium text-foreground">{starter.label}</span> and reports back.
            </p>
            <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground italic">
              &ldquo;{starter.persona}&rdquo;
            </div>
            <Button onClick={createSkill} disabled={busy} className="w-full">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</> : <>Create this skill <ArrowRight className="h-4 w-4 ml-1.5" /></>}
            </Button>
          </div>
        )}

        {/* Step 3 — run */}
        {step === 2 && !ran && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Run it once</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Run the skill now. It&apos;ll read your demo {starter?.label.toLowerCase()} and report what it sees —
              this is exactly what an automated run does, just triggered by you.
            </p>
            <Button onClick={runSkill} disabled={busy} className="w-full">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</> : <>Run my skill ▷</>}
            </Button>
          </div>
        )}

        {/* Done */}
        {ran && (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-11 w-11 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-500" />
            </div>
            <h2 className="font-semibold text-lg">That&apos;s the whole loop 🎉</h2>
            <p className="text-sm text-muted-foreground">
              You connected a tool, created a skill, and ran it. See what it did in the run history —
              or head to your dashboard to connect a real app next.
            </p>
            <div className="flex gap-2 justify-center pt-1">
              {skillId && (
                <Button onClick={() => router.push(`/skills/${skillId}`)} variant="outline" size="sm">
                  View run history
                </Button>
              )}
              <Button onClick={() => { router.push('/dashboard'); router.refresh() }} size="sm">
                Go to dashboard
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-4 text-center">{error}</p>}
      </div>

      {!ran && (
        <p className="text-center mt-5">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip setup — I&apos;ll explore on my own
          </Link>
        </p>
      )}
    </div>
  )
}

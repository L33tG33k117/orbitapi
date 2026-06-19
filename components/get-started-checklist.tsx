'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, ArrowRight, Sparkles, X, Plug, MessageSquare, Zap, Layers, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChecklistState {
  connected: boolean
  askedAssistant: boolean
  savedSkill: boolean
  grouped: boolean
  automated: boolean
}

const DISMISS_KEY = 'orbit:getstarted-dismissed'

interface Step {
  key: keyof ChecklistState
  label: string
  desc: string
  href: string
  cta: string
  icon: React.ComponentType<{ className?: string }>
}

// The order encodes the mental model: connect → ask → save → group → automate.
// Each step builds on the one before it, which is the thing new users miss.
const STEPS: Step[] = [
  { key: 'connected', label: 'Connect (or simulate) an API', desc: 'A connector links an app’s API to OrbitAPI. No keys handy? Hit “Simulate” to try one with realistic fake data.', href: '/connectors', cta: 'Browse connectors', icon: Plug },
  { key: 'askedAssistant', label: 'Ask the Orbit Assistant', desc: 'Talk to your connected apps in plain English — “list my open invoices”, “show recent detections”. It calls the APIs for you.', href: '/chat', cta: 'Open Assistant', icon: MessageSquare },
  { key: 'savedSkill', label: 'Save it as a Skill', desc: 'A Skill is a reusable agent with a persona — turn a useful chat into something you can re-run any time.', href: '/skills', cta: 'Create a skill', icon: Zap },
  { key: 'grouped', label: 'Group your connectors', desc: 'A Group bundles connections so a Skill knows exactly which apps it’s allowed to use. Optional, but keeps skills focused.', href: '/groups', cta: 'Create a group', icon: Layers },
  { key: 'automated', label: 'Automate it', desc: 'Run a Skill on a schedule or have it trigger on events — hands-free. This is where OrbitAPI does the work for you.', href: '/skills', cta: 'Run a skill', icon: CalendarClock },
]

export function GetStartedChecklist({ state }: { state: ChecklistState }) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1') } catch { /* ignore */ }
  }, [])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  const done = STEPS.filter(s => state[s.key]).length
  const total = STEPS.length
  const allDone = done === total
  const pct = Math.round((done / total) * 100)

  // Avoid SSR/client mismatch (localStorage is client-only); hide once dismissed
  // or once every step is complete (the user clearly knows their way around).
  if (!mounted || dismissed || allDone) return null

  return (
    <div data-tour="dash-getstarted" className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-lg">Get started with OrbitAPI</h2>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mt-1 -mr-1 p-1"
          title="Dismiss — you can always reopen this from the Help Guide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground mt-1">
        Five steps, each building on the last — this is how the pieces fit together.
      </p>

      {/* Progress */}
      <div className="mt-4 mb-6 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-muted-foreground shrink-0">{done} of {total}</span>
      </div>

      {/* Fastest path to an "aha" for a brand-new workspace: install a vertical
          bundle that runs entirely on realistic demo data — no API keys at all. */}
      {done === 0 && (
        <Link
          href="/bundles"
          className="mb-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3.5 hover:bg-primary/[0.1] transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">See it work in one click</p>
            <p className="text-xs text-muted-foreground">Install a starter bundle — connectors, skills, and playbooks that run on realistic demo data. No API keys needed.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </Link>
      )}

      <ol className="space-y-2.5">
        {STEPS.map((s, i) => {
          const complete = state[s.key]
          const Icon = s.icon
          // The first incomplete step is the "next" one — highlight it.
          const isNext = !complete && STEPS.slice(0, i).every(p => state[p.key])
          return (
            <li
              key={s.key}
              className={cn(
                'flex items-start gap-3.5 rounded-xl border p-3.5 transition-colors',
                complete ? 'border-emerald-500/20 bg-emerald-500/[0.04]' :
                isNext ? 'border-primary/30 bg-primary/[0.04]' : 'border-border bg-card/40',
              )}
            >
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                complete ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                         : 'bg-muted border-border text-muted-foreground',
              )}>
                {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold text-sm', complete && 'text-muted-foreground line-through decoration-emerald-500/40')}>
                  {s.label}
                </p>
                {!complete && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>}
              </div>
              {!complete && (
                <Link
                  href={s.href}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium shrink-0 mt-0.5 transition-colors',
                    isNext ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.cta} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

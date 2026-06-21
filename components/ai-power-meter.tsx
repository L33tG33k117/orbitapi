'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Gauge } from 'lucide-react'

export interface AiPowerState {
  remaining: number
  allowance: number
  pctUsed: number
  resetInDays: number
  isTrial: boolean
  tier: string
}

// Live AI Power meter for the Orbit Assistant. Renders the workspace's remaining
// power as a bar, refetches whenever a chat message finishes (via the
// `orbit:power-changed` window event), and briefly flashes how much the last
// message cost so users can see what talking to the AI uses.
export function AiPowerMeter({ initial }: { initial: AiPowerState }) {
  const [power, setPower] = useState<AiPowerState>(initial)
  const [spent, setSpent] = useState<number | null>(null)
  const prevRemaining = useRef(initial.remaining)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-power', { cache: 'no-store' })
      if (!res.ok) return
      const next = (await res.json()) as AiPowerState
      const delta = prevRemaining.current - next.remaining
      if (delta > 0) {
        setSpent(delta)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setSpent(null), 4000)
      }
      prevRemaining.current = next.remaining
      setPower(next)
    } catch { /* keep showing the last known value */ }
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener('orbit:power-changed', onChange)
    return () => {
      window.removeEventListener('orbit:power-changed', onChange)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [refresh])

  const pctLeft = power.allowance > 0 ? Math.max(0, Math.min(100, 100 - power.pctUsed)) : 0
  const low = pctLeft <= 20
  const empty = power.remaining <= 0
  const barColor = empty || low ? 'bg-amber-500' : 'bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)]'

  const resetHint = power.isTrial
    ? 'Free trial pool — does not refill'
    : power.resetInDays > 0
      ? `Refreshes in ${power.resetInDays} day${power.resetInDays === 1 ? '' : 's'}`
      : 'Refreshes today'

  return (
    <div
      className="flex items-center gap-2.5 text-xs"
      title={`${power.remaining.toLocaleString()} of ${power.allowance.toLocaleString()} AI Power remaining · ${resetHint}`}
    >
      <Gauge className={`h-3.5 w-3.5 shrink-0 ${low || empty ? 'text-amber-500' : 'text-primary'}`} />
      <span className="text-muted-foreground hidden sm:inline">AI Power</span>

      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pctLeft}%` }} />
      </div>

      <span className="font-medium tabular-nums text-foreground">
        {power.remaining.toLocaleString()}
        <span className="text-muted-foreground font-normal"> left</span>
      </span>

      {/* Flash how much the last message cost */}
      {spent !== null && spent > 0 && (
        <span className="text-amber-500 font-medium tabular-nums animate-in fade-in slide-in-from-bottom-1" key={spent}>
          −{spent.toLocaleString()}
        </span>
      )}

      {(empty || low) && (
        <Link href="/ai-power" className="text-primary hover:underline font-medium shrink-0">
          {empty ? 'Get more' : 'Top up'}
        </Link>
      )}
    </div>
  )
}

'use client'

import { useSyncExternalStore, useEffect, useState } from 'react'
import { Rocket, Check, X } from 'lucide-react'
import { subscribeLaunches, getLaunches, getLaunchesServer, type Launch } from '@/lib/launch-store'

// Mission Control — the live launch strip in the Starlab hero. Every launch
// (skill / playbook / app run) lifts off from the pad and climbs toward the
// orbit line: climbing = still running, reaching orbit = done, back on the
// pad in red = failed. It's a costume over the same launch-store data the
// top-bar rocket tray uses — the climb is time-eased (runs don't report a
// real %), then snaps to orbit the moment the run finishes.

const MAX_ROCKETS = 5

// Eased "altitude" (0–100) for a launch. Running rockets climb fast at first
// and approach ~88% asymptotically so they never stall visibly at the top.
function altitude(l: Launch, now: number): number {
  if (l.status === 'done') return 100
  if (l.status === 'failed') return 0
  return 6 + 82 * (1 - Math.exp(-(now - l.startedAt) / 12000))
}

function seconds(l: Launch, now: number): number {
  return Math.max(1, Math.round(((l.endedAt ?? now) - l.startedAt) / 1000))
}

export function StarlabMissionControl() {
  const launches = useSyncExternalStore(subscribeLaunches, getLaunches, getLaunchesServer)
  const [now, setNow] = useState(() => Date.now())

  const flights = launches.slice(0, MAX_ROCKETS)
  const anyRunning = flights.some(l => l.status === 'running')

  // Tick while anything is in flight so altitude + elapsed keep moving.
  useEffect(() => {
    if (!anyRunning) return
    const iv = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(iv)
  }, [anyRunning])

  return (
    <div data-tour="starlab-pad" className="relative mt-6 h-40 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Orbit line */}
      <div className="absolute left-0 right-0 top-6 flex items-center gap-2 px-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/30 shrink-0">Orbit</span>
        <div className="h-px flex-1 border-t border-dashed border-white/20" />
      </div>
      {/* Launch pad */}
      <div className="absolute left-0 right-0 bottom-7 px-3">
        <div className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      {flights.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-4">
          <Rocket className="h-5 w-5 text-white/25" />
          <p className="text-xs text-white/45">
            Pad is clear. Hit <span className="font-medium text-white/70">Run</span> on anything below and watch it lift off here.
          </p>
        </div>
      ) : (
        <div className="absolute inset-x-0 top-9 bottom-7 flex justify-around px-2">
          {flights.map(l => {
            const alt = altitude(l, now)
            return (
              <div key={l.id} className="relative w-24 max-w-[25%]">
                {/* Rocket (or its fate) — bottom offset is the altitude */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 transition-[bottom] duration-500 ease-out"
                  style={{ bottom: `${alt}%` }}
                >
                  {l.status === 'done' ? (
                    <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/40">
                      <span className="mc-orbit-pulse absolute inset-0 rounded-full border border-emerald-400/50" />
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  ) : l.status === 'failed' ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 border border-red-400/40">
                      <X className="h-3.5 w-3.5 text-red-400" />
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center">
                      <Rocket className="h-6 w-6 -rotate-45 text-white drop-shadow-[0_0_6px_oklch(0.7_0.18_274/60%)]" />
                      <span className="mc-flame mt-0.5 h-3.5 w-1.5 rounded-full bg-gradient-to-b from-amber-300 via-orange-400 to-transparent" />
                    </div>
                  )}
                </div>
                {/* Name plate stays on the pad */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-full text-center">
                  <p className="text-[10px] font-medium text-white/70 truncate">{l.name}</p>
                  <p className="text-[9px] text-white/35 tabular-nums">
                    {l.status === 'running' ? `${seconds(l, now)}s · climbing`
                      : l.status === 'done' ? `in orbit · ${seconds(l, now)}s`
                      : 'launch failed'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

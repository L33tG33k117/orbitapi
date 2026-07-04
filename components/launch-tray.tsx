'use client'

import { useSyncExternalStore, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Rocket, Check, X, Zap, ShieldAlert, Wrench, ArrowRight } from 'lucide-react'
import {
  subscribeLaunches, getLaunches, getLaunchesServer, clearFinishedLaunches, type Launch,
} from '@/lib/launch-store'

const KIND_ICON = { skill: Zap, playbook: ShieldAlert, action: Wrench }

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])
  return <span>{Math.max(1, Math.round((Date.now() - since) / 1000))}s</span>
}

function LaunchRow({ l, onClose }: { l: Launch; onClose: () => void }) {
  const Icon = KIND_ICON[l.kind]
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{l.name}</span>
        {l.status === 'running' && <span className="text-[11px] text-muted-foreground shrink-0"><Elapsed since={l.startedAt} /></span>}
        {l.status === 'done' && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
        {l.status === 'failed' && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
      </div>
      {l.status === 'running' && (
        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] launch-indeterminate" />
        </div>
      )}
      {l.status === 'failed' && l.error && <p className="mt-1 text-[11px] text-destructive/80 line-clamp-2">{l.error}</p>}
      {l.status === 'done' && (
        <Link href={l.href} onClick={onClose} className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          View result <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export function LaunchTray() {
  const launches = useSyncExternalStore(subscribeLaunches, getLaunches, getLaunchesServer)
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  const running = launches.filter(l => l.status === 'running').length
  const active = launches.length > 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Nothing has launched yet → keep the top bar clean.
  if (!active) return null

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title={running > 0 ? `${running} running…` : 'Launches'}
        className="relative inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Rocket className={`h-4 w-4 ${running > 0 ? 'text-primary launch-wiggle' : ''}`} />
        {running > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {running}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          className="fixed z-[200] w-72 rounded-xl border bg-popover shadow-xl overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5 text-primary" /> Launches</span>
            <Link href="/starlab" onClick={() => setOpen(false)} className="text-[11px] text-primary hover:underline">Open Starlab →</Link>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {launches.map(l => <LaunchRow key={l.id} l={l} onClose={() => setOpen(false)} />)}
          </div>
          {launches.some(l => l.status !== 'running') && (
            <button onClick={clearFinishedLaunches} className="w-full py-2 text-[11px] text-muted-foreground hover:text-foreground border-t transition-colors">
              Clear finished
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

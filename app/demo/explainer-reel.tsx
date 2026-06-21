'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Orbit, Plug, MessageSquare, Satellite, ArrowRight, RotateCcw } from 'lucide-react'
import { CosmicBackground } from '@/components/cosmic-background'

// A short, self-playing, looping explainer for OrbitAPI — logo → tagline →
// the three steps → closing card, over the orbiting cosmos. Built to be played
// full-screen and screen-recorded into a shareable clip. ~14s loop.

interface Scene {
  ms: number
  render: (active: boolean) => React.ReactNode
}

function SceneShell({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center text-center px-8 transition-all duration-700 ${
        active ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      {children}
    </div>
  )
}

const CONNECTORS = ['crowdstrike', 'netsuite', 'servicenow', 'slack', 'teams', 'sendgrid', 'twilio', 'pagerduty']

export function ExplainerReel() {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scenes: Scene[] = [
    // 0 — Logo + tagline
    {
      ms: 3000,
      render: active => (
        <>
          <div className={`relative h-20 w-20 rounded-3xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center shadow-[0_8px_40px_-8px_var(--brand-to)] ${active ? 'animate-glow-pulse' : ''}`}>
            <Orbit className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-7 text-5xl sm:text-6xl font-extrabold tracking-tight text-white">OrbitAPI</h1>
          <p className="mt-3 text-xl text-white/60">
            Every API in <span className="text-gradient-animated font-semibold">your orbit</span>
          </p>
        </>
      ),
    },
    // 1 — What it is
    {
      ms: 3000,
      render: () => (
        <>
          <p className="text-sm uppercase tracking-[0.2em] text-[oklch(0.75_0.18_264)] mb-4">Mission control for your tech stack</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white max-w-2xl leading-tight">
            Connect every tool you use — then command them all from one place.
          </h2>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap max-w-md">
            {CONNECTORS.map((slug, i) => (
              <div
                key={slug}
                className="h-9 w-9 rounded-lg overflow-hidden opacity-80 animate-float"
                style={{ animationDelay: `${i * 0.25}s` }}
                title={slug}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/logos/${slug}.svg`} alt={slug} className="h-full w-full object-cover" />
              </div>
            ))}
            <span className="text-sm text-white/40">+ 95 more</span>
          </div>
        </>
      ),
    },
    // 2 — Step 1: connect
    { ms: 2400, render: () => <StepCard n="01" icon={Plug} title="Connect 100+ APIs" sub="Security, finance, comms, IoT — connect in one click, or simulate with demo data." /> },
    // 3 — Step 2: command (with a mini chat)
    {
      ms: 3400,
      render: active => (
        <>
          <StepCard n="02" icon={MessageSquare} title="Command in plain English" sub="Ask Orbit Assistant — it calls the APIs and chains actions for you." />
          <div className={`mt-7 w-full max-w-md space-y-2 text-left transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-[oklch(0.46_0.19_264)] text-white text-sm px-4 py-2.5">
              Show critical invoices over $50k and alert the team
            </div>
            <div className="w-fit max-w-[90%] rounded-2xl bg-white/10 text-white/90 text-sm px-4 py-2.5">
              <span className="text-[oklch(0.78_0.12_200)]">✓</span> Found 3 · emailed Finance · posted to Teams — in 2.3s
            </div>
          </div>
        </>
      ),
    },
    // 4 — Step 3: autonomous
    { ms: 2600, render: () => <StepCard n="03" icon={Satellite} title="Runs autonomously" sub="Turn any workflow into a skill that runs on a schedule or reacts to events." /> },
    // 5 — Closing card
    {
      ms: 3200,
      render: () => (
        <>
          <Orbit className="h-12 w-12 text-[oklch(0.7_0.2_264)] animate-float" />
          <h2 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-white">Enter orbit</h2>
          <p className="mt-3 text-white/60 text-lg">Mission control for the modern tech stack.</p>
          <div className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[oklch(0.46_0.19_264)] text-white font-semibold animate-glow-pulse">
            Start free <ArrowRight className="h-4 w-4" />
          </div>
          <p className="mt-4 text-sm text-white/40">orbitapi</p>
        </>
      ),
    },
  ]

  const total = scenes.reduce((a, s) => a + s.ms, 0)

  const advance = useCallback((from: number) => {
    const dur = scenes[from].ms
    timer.current = setTimeout(() => {
      setScene(prev => {
        const next = (prev + 1) % scenes.length
        return next
      })
    }, dur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!playing) return
    advance(scene)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [scene, playing, advance])

  function replay() {
    if (timer.current) clearTimeout(timer.current)
    setScene(0)
    setPlaying(true)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[oklch(0.07_0.02_268)]">
      <CosmicBackground autoSpin />

      {/* Scenes */}
      <div className="relative z-10 h-full w-full">
        {scenes.map((s, i) => (
          <SceneShell key={i} active={i === scene}>{s.render(i === scene)}</SceneShell>
        ))}
      </div>

      {/* Loop progress bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 h-1 bg-white/5">
        <div
          key={scene}
          className="h-full bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)]"
          style={{ width: '100%', animation: `reel-progress ${scenes[scene].ms}ms linear` }}
        />
      </div>

      {/* Replay (hidden during recording if you full-screen + move the mouse away) */}
      <button
        onClick={replay}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium backdrop-blur transition-colors opacity-40 hover:opacity-100"
        title="Replay"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Replay
      </button>

      <style>{`
        @keyframes reel-progress { from { width: 0% } to { width: 100% } }
      `}</style>

      {/* total loop length, kept for clarity */}
      <span className="sr-only">Loop length {Math.round(total / 1000)}s</span>
    </div>
  )
}

function StepCard({ n, icon: Icon, title, sub }: { n: string; icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-5xl font-black text-white/10">{n}</span>
        <div className="h-14 w-14 rounded-2xl bg-[oklch(0.46_0.19_264)]/20 border border-[oklch(0.46_0.19_264)]/30 flex items-center justify-center">
          <Icon className="h-7 w-7 text-[oklch(0.72_0.18_264)]" />
        </div>
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-white">{title}</h2>
      <p className="mt-3 text-white/55 text-lg max-w-md">{sub}</p>
    </>
  )
}

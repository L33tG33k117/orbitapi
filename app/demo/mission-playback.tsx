'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Orbit, ArrowRight, Pause, Play, ShieldCheck, ScrollText, RotateCcw } from 'lucide-react'
import { CosmicBackground } from '@/components/cosmic-background'

// Live mission playback — one continuous animated scene, not a slideshow.
// An orbit map of real connectors fires in sync with a terminal feed while
// three missions play on loop. The security mission pauses on a real
// "Approve" button so the viewer *is* the human-in-the-loop (auto-approves
// after a few seconds so an unattended loop never stalls).

// ── Timeline types ─────────────────────────────────────────────────────────

type Tone = 'violet' | 'blue' | 'purple' | 'green' | 'amber'

type Step =
  | { type: 'type'; text: string }
  | { type: 'chips'; chips: { label: string; tone: Tone }[]; nodes: string[]; ms?: number }
  | { type: 'text'; html: string; ms?: number }
  | { type: 'approval'; label: string; node: string }
  | { type: 'done'; text: string; ms?: number }

interface Mission {
  id: string
  label: string
  steps: Step[]
}

const MISSIONS: Mission[] = [
  {
    id: 'security',
    label: 'Security response',
    steps: [
      { type: 'type', text: 'Any critical detections overnight? Contain affected hosts and open an incident for each.' },
      { type: 'chips', chips: [{ label: 'CrowdStrike → list_detections', tone: 'violet' }], nodes: ['crowdstrike'] },
      { type: 'text', html: '<strong class="text-white">2 critical detections</strong> since 11 PM — credential theft on LAPTOP-7F2, lateral movement from 10.0.4.18.' },
      { type: 'chips', chips: [{ label: 'ServiceNow → create_incident ×2', tone: 'blue' }], nodes: ['servicenow'] },
      { type: 'approval', label: 'Contain LAPTOP-7F2?', node: 'crowdstrike' },
      { type: 'chips', chips: [{ label: 'CrowdStrike → contain_host ✓ approved', tone: 'green' }], nodes: ['crowdstrike'] },
      { type: 'chips', chips: [{ label: 'PagerDuty → resolve standby', tone: 'purple' }], nodes: ['pagerduty'] },
      { type: 'done', text: '✓ Host contained · 2 incidents opened · every step in the audit trail' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance patrol',
    steps: [
      { type: 'type', text: 'Show open critical invoices over $50k, email me a summary, and post it to Teams.' },
      { type: 'chips', chips: [{ label: 'NetSuite → list_open_invoices', tone: 'violet' }], nodes: ['netsuite'] },
      { type: 'text', html: '<strong class="text-white">3 invoices</strong> — $247,800 total. Acme Corp is 14 days overdue.' },
      { type: 'chips', chips: [
        { label: 'SendGrid → send_alert_email', tone: 'blue' },
        { label: 'Teams → send_alert', tone: 'purple' },
      ], nodes: ['sendgrid', 'teams'] },
      { type: 'done', text: '✓ Summary emailed · channel notified · 3 APIs, one sentence, 2.3s' },
    ],
  },
  {
    id: 'support',
    label: 'Support triage',
    steps: [
      { type: 'type', text: 'Find tickets about to breach SLA, draft replies, and post a summary to Slack.' },
      { type: 'chips', chips: [{ label: 'Zendesk → search_tickets', tone: 'violet' }], nodes: ['zendesk'] },
      { type: 'text', html: '<strong class="text-white">4 tickets</strong> breach SLA within 2 hours — one login outage, two billing, one refund.' },
      { type: 'chips', chips: [
        { label: 'Zendesk → add_ticket_comment ×4', tone: 'blue' },
        { label: 'Slack → send_message', tone: 'purple' },
      ], nodes: ['zendesk', 'slack'] },
      { type: 'done', text: '✓ 4 drafts ready for review · #support-escalations briefed · SLA saved' },
    ],
  },
]

// ── Orbit map geometry ─────────────────────────────────────────────────────

const NODES = ['crowdstrike', 'servicenow', 'pagerduty', 'slack', 'netsuite', 'sendgrid', 'teams', 'zendesk']

// Percent coordinates on a circle around the core (50,50).
const NODE_POS: Record<string, { x: number; y: number }> = Object.fromEntries(
  NODES.map((slug, i) => {
    const angle = (i / NODES.length) * Math.PI * 2 - Math.PI / 2
    return [slug, { x: 50 + 40 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) }]
  })
)

const CHIP_TONES: Record<Tone, string> = {
  violet: 'bg-[oklch(0.46_0.19_264)]/15 border-[oklch(0.46_0.19_264)]/20 text-[oklch(0.72_0.18_264)]',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
}

const TYPE_MS = 26           // per character while the prompt types
const APPROVAL_AUTO_MS = 6000
const MISSION_GAP_MS = 1600

type Feed =
  | { kind: 'prompt'; text: string }
  | { kind: 'chips'; chips: { label: string; tone: Tone }[] }
  | { kind: 'text'; html: string }
  | { kind: 'approval-note' }
  | { kind: 'done'; text: string }

export function MissionPlayback() {
  const [missionIdx, setMissionIdx] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [typed, setTyped] = useState(0)
  const [feed, setFeed] = useState<Feed[]>([])
  const [activeNodes, setActiveNodes] = useState<string[]>([])
  const [approval, setApproval] = useState<{ label: string; node: string } | null>(null)
  const [playing, setPlaying] = useState(true)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const mission = MISSIONS[missionIdx]

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }

  const goToMission = useCallback((idx: number) => {
    clearTimers()
    setMissionIdx(idx)
    setStepIdx(0)
    setTyped(0)
    setFeed([])
    setActiveNodes([])
    setApproval(null)
  }, [])

  const approve = useCallback(() => {
    setApproval(null)
    setStepIdx(s => s + 1)
  }, [])

  // Timeline engine: each step schedules its own completion.
  useEffect(() => {
    if (!playing) return
    const steps = MISSIONS[missionIdx].steps
    if (stepIdx >= steps.length) {
      later(() => goToMission((missionIdx + 1) % MISSIONS.length), MISSION_GAP_MS)
      return clearTimers
    }
    const step = steps[stepIdx]

    if (step.type === 'type') {
      // Type into the chat input bar; when finished, it "sends" and jumps up as
      // a user message bubble — so it reads like using the real chat, not a CLI.
      let i = 0
      const iv = setInterval(() => {
        i++
        setTyped(i)
        if (i >= step.text.length) {
          clearInterval(iv)
          later(() => { setFeed([{ kind: 'prompt', text: step.text }]); setTyped(0); setStepIdx(s => s + 1) }, 450)
        }
      }, TYPE_MS)
      timers.current.push(iv as unknown as ReturnType<typeof setTimeout>)
      return clearTimers
    }

    if (step.type === 'chips') {
      setFeed(f => [...f, { kind: 'chips', chips: step.chips }])
      setActiveNodes(step.nodes)
      later(() => setStepIdx(s => s + 1), step.ms ?? 1900)
      return clearTimers
    }

    if (step.type === 'text') {
      setFeed(f => [...f, { kind: 'text', html: step.html }])
      later(() => setStepIdx(s => s + 1), step.ms ?? 2100)
      return clearTimers
    }

    if (step.type === 'approval') {
      setFeed(f => [...f, { kind: 'approval-note' }])
      setApproval({ label: step.label, node: step.node })
      setActiveNodes([step.node])
      later(approve, APPROVAL_AUTO_MS) // never let an unattended loop stall
      return clearTimers
    }

    // done
    setFeed(f => [...f, { kind: 'done', text: step.text }])
    setActiveNodes([])
    later(() => setStepIdx(s => s + 1), step.ms ?? 2600)
    return clearTimers
  }, [missionIdx, stepIdx, playing, goToMission, approve])

  // Pause/resume simply freezes the engine (timers cleared by effect teardown).
  useEffect(() => { if (!playing) clearTimers() }, [playing])

  const typingStep = mission.steps[stepIdx]
  const typingText = typingStep?.type === 'type' ? typingStep.text.slice(0, typed) : null

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden flex flex-col">
      <CosmicBackground />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
              <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">OrbitAPI</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live mission playback
          </div>
          <Link
            href="/signup"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[oklch(0.46_0.19_264)] text-white text-sm font-medium hover:bg-[oklch(0.52_0.2_264)] transition-colors"
          >
            Do this for real <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {/* Mission picker */}
        <div className="flex items-center justify-center gap-2 px-6 pt-2 pb-4 flex-wrap">
          {MISSIONS.map((m, i) => (
            <button
              key={m.id}
              onClick={() => goToMission(i)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                i === missionIdx
                  ? 'border-[oklch(0.46_0.19_264)]/60 bg-[oklch(0.46_0.19_264)]/20 text-white'
                  : 'border-white/10 text-white/40 hover:text-white/80'
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
            className="ml-1 h-7 w-7 rounded-full border border-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <button
            onClick={() => goToMission(missionIdx)}
            aria-label="Replay mission"
            className="h-7 w-7 rounded-full border border-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>

        {/* Stage */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 px-6 pb-6 max-w-6xl mx-auto w-full">
          {/* Orbit map */}
          <div className="relative w-full max-w-[420px] aspect-square shrink-0">
            {/* Beams */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden>
              {NODES.map(slug => {
                const p = NODE_POS[slug]
                const active = activeNodes.includes(slug)
                return (
                  <line
                    key={slug}
                    x1="50" y1="50" x2={p.x} y2={p.y}
                    stroke={active ? 'oklch(0.7 0.2 264)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={active ? 0.7 : 0.3}
                    className="transition-all duration-500"
                  />
                )
              })}
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" strokeDasharray="1.5 2.5" />
            </svg>

            {/* Core */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br from-[oklch(0.46_0.19_264)] to-[oklch(0.4_0.2_290)] flex items-center justify-center shadow-[0_0_50px_-8px_oklch(0.55_0.2_264)] ${activeNodes.length ? 'animate-glow-pulse' : ''}`}>
                <Orbit className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* App nodes */}
            {NODES.map(slug => {
              const p = NODE_POS[slug]
              const active = activeNodes.includes(slug)
              const isApprovalTarget = approval?.node === slug
              return (
                <div
                  key={slug}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  <div className={`relative h-11 w-11 rounded-xl overflow-hidden border transition-all duration-500 ${
                    active
                      ? 'border-[oklch(0.7_0.2_264)]/70 opacity-100 scale-110 shadow-[0_0_24px_-4px_oklch(0.6_0.2_264)]'
                      : 'border-white/10 opacity-45 scale-100'
                  } ${isApprovalTarget ? '!border-amber-400/80 shadow-[0_0_24px_-4px_#f59e0b]' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/logos/${slug}.svg`} alt={slug} className="h-full w-full object-cover" />
                  </div>
                  {active && (
                    <span className="absolute inset-0 rounded-xl border border-[oklch(0.7_0.2_264)]/50 animate-ping" aria-hidden />
                  )}
                </div>
              )
            })}

            {/* Approval card — the viewer is the human in the loop */}
            {approval && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[6%] z-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl border border-amber-400/40 bg-[oklch(0.11_0.02_268)]/95 backdrop-blur px-4 py-3 shadow-2xl shadow-black/50 text-center space-y-2">
                  <p className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5 justify-center">
                    <ShieldCheck className="h-3.5 w-3.5" /> Destructive action — needs a human
                  </p>
                  <p className="text-sm font-semibold">{approval.label}</p>
                  <button
                    onClick={approve}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
                  >
                    Approve — you&apos;re the operator
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* The app on a laptop — this is what you'll actually see and use */}
          <div className="w-full max-w-xl">
            <div className="relative">
              {/* Screen */}
              <div className="rounded-t-2xl border border-white/12 border-b-0 bg-[oklch(0.09_0.018_268)] overflow-hidden shadow-2xl shadow-black/60">
                {/* Browser chrome — grounds it as "this is the real app in your browser" */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/8 bg-[oklch(0.12_0.02_268)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                  <div className="ml-3 flex-1 flex justify-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-white/[0.06] text-[10px] text-white/40">
                      <span className="text-emerald-400/70">🔒</span> app.orbitapi.com/chat
                    </div>
                  </div>
                </div>

                {/* App body: a hint of the sidebar + the Orbit Assistant chat */}
                <div className="flex min-h-[340px]">
                  {/* Mini sidebar — outlines the real OrbitAPI shell */}
                  <div className="hidden sm:flex flex-col items-center gap-1 w-12 py-3 border-r border-white/8 bg-[oklch(0.075_0.016_268)]">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[oklch(0.46_0.19_264)] to-[oklch(0.4_0.2_290)] flex items-center justify-center mb-2">
                      <Orbit className="h-3.5 w-3.5 text-white" />
                    </div>
                    {[false, true, false, false, false].map((activeDot, i) => (
                      <div key={i} className={`h-6 w-6 rounded-md flex items-center justify-center ${activeDot ? 'bg-[oklch(0.46_0.19_264)]/25' : ''}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${activeDot ? 'bg-[oklch(0.72_0.18_264)]' : 'bg-white/20'}`} />
                      </div>
                    ))}
                  </div>

                  {/* Chat column */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                      <div className="flex items-center gap-2">
                        <span className="text-[oklch(0.72_0.18_264)]">✦</span>
                        <span className="text-sm font-semibold">Orbit Assistant</span>
                      </div>
                      <span className="text-[10px] text-white/30 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI Power ready
                      </span>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 space-y-2.5 text-sm overflow-hidden">
                      {feed.map((item, i) => {
                        if (item.kind === 'prompt') {
                          return (
                            <div key={i} className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-300">
                              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-[oklch(0.46_0.19_264)] to-[oklch(0.42_0.2_278)] px-3.5 py-2 text-white shadow-lg">
                                {item.text}
                              </div>
                            </div>
                          )
                        }
                        if (item.kind === 'chips') {
                          return (
                            <div key={i} className="flex justify-start">
                              <div className="max-w-[90%] flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-400">
                                {item.chips.map(c => (
                                  <span key={c.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${CHIP_TONES[c.tone]}`}>
                                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse inline-block shrink-0 opacity-70" />
                                    {c.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        if (item.kind === 'text') {
                          return (
                            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-400">
                              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/8 px-3.5 py-2 text-white/80" dangerouslySetInnerHTML={{ __html: item.html }} />
                            </div>
                          )
                        }
                        if (item.kind === 'approval-note') {
                          return (
                            <div key={i} className="flex justify-start animate-in fade-in duration-400">
                              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-amber-500/10 border border-amber-500/25 px-3.5 py-2 text-amber-300/90 text-xs flex items-center gap-1.5">
                                ⏸ Paused — waiting for your approval (that&apos;s you)
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-400">
                            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 text-emerald-200/90">
                              {item.text}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Input bar — the prompt types here, like you're using it */}
                    <div className="p-3 border-t border-white/8 flex items-center gap-2">
                      <div className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm min-h-[38px] flex items-center">
                        {typingText
                          ? <span className="text-white/85">{typingText}<span className="inline-block w-1.5 h-4 bg-white/60 animate-pulse align-middle ml-0.5" /></span>
                          : <span className="text-white/30">Ask anything about your connected apps…</span>}
                      </div>
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${typingText ? 'bg-[oklch(0.46_0.19_264)] text-white' : 'bg-white/10 text-white/40'}`}>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Governance strip */}
                <div className="px-4 py-2 border-t border-white/8 bg-[oklch(0.07_0.016_268)] flex items-center gap-2 text-[10px] text-white/35">
                  <ScrollText className="h-3 w-3" /> every action lands in a searchable, replayable audit trail
                </div>
              </div>

              {/* Laptop base / hinge */}
              <div className="h-2.5 rounded-b-md bg-gradient-to-b from-[oklch(0.17_0.02_268)] to-[oklch(0.1_0.018_268)] border-x border-b border-white/12" />
              <div className="mx-auto h-1.5 w-2/5 rounded-b-xl bg-[oklch(0.13_0.02_268)] shadow-lg" />
            </div>

            {/* Keep first paint honest */}
            <p className="mt-5 text-center text-xs text-white/35">
              This is the actual app, not a video — Simulated mode runs these exact missions the minute you sign up.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
              >
                Run your first mission free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/" className="text-sm text-white/45 hover:text-white transition-colors">
                Back to site
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

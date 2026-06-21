'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Clock, Webhook, Check, RotateCcw, Plug, Zap, Workflow,
  Gauge, GitBranch, ShieldCheck, Wrench, Bell,
} from 'lucide-react'
import { CosmicBackground } from '@/components/cosmic-background'

// A live concept diagram of how you GROW with OrbitAPI — the product's real
// progression:
//   1. Connect your apps (connectors)
//   2. Create a Skill — ask / schedule in plain language; Orbit runs it across apps
//   3. Build Playbooks — a multi-step flow (Assess → Decide → Approve → Act →
//      Notify) with severity-based autonomy: auto-acts when confident, asks you
//      when unsure. (Per the real engine: nodes, not chained Skills.)
// Loops; respects reduced-motion.

const VB = { w: 960, h: 540 }
const HUB = { x: 400, y: 272, r: 54 }
const TRIGGER = { x: 116, y: 272 }
const APP_RADIUS = 250

const APPS = [
  { slug: 'crowdstrike', label: 'CrowdStrike', deg: -62 },
  { slug: 'pagerduty', label: 'PagerDuty', deg: -31 },
  { slug: 'slack', label: 'Slack', deg: 0 },
  { slug: 'teams', label: 'Teams', deg: 31 },
  { slug: 'netsuite', label: 'NetSuite', deg: 62 },
].map(a => {
  const rad = (a.deg * Math.PI) / 180
  return { ...a, x: Math.round(HUB.x + APP_RADIUS * Math.cos(rad)), y: Math.round(HUB.y + APP_RADIUS * Math.sin(rad)) }
})

const STAGES = [
  { badge: 'Connect', icon: Plug, caption: 'Step 1 — Connect your apps. Link the tools you already use, in a click.' },
  { badge: 'Skill', icon: Zap, caption: 'Step 2 — Create a Skill. Ask in plain English or on a schedule — Orbit runs the task across your apps.' },
  { badge: 'Playbook', icon: Workflow, caption: 'Step 3 — Build Playbooks. A multi-step flow that auto-acts when confident and pauses for your approval when it’s unsure.' },
]
const STEP_MS = 4200

// Playbook flow nodes (the real engine step types), laid out left→right.
const FLOW = [
  { key: 'assess', label: 'Assess', hint: 'AI scores 0–10', icon: Gauge, x: 120 },
  { key: 'decide', label: 'Decide', hint: 'branch on severity', icon: GitBranch, x: 300 },
  { key: 'approve', label: 'Approve', hint: 'pause for you', icon: ShieldCheck, x: 480 },
  { key: 'act', label: 'Act', hint: 'across your apps', icon: Wrench, x: 660 },
  { key: 'notify', label: 'Notify', hint: 'report back', icon: Bell, x: 840 },
] as const
const FLOW_Y = 232
const CHIP_W = 132

function Pulse({ sx, sy, ex, ey, color, begin = '0s', dur = '1.1s' }: {
  sx: number; sy: number; ex: number; ey: number; color: string; begin?: string; dur?: string
}) {
  return (
    <circle r="5.5" fill={color} opacity="0">
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={`M ${sx} ${sy} L ${ex} ${ey}`} />
      <animate attributeName="opacity" dur={dur} begin={begin} repeatCount="indefinite" keyTimes="0;0.15;0.85;1" values="0;1;1;0" />
    </circle>
  )
}

export function ExplainerDiagram() {
  const [scene, setScene] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timer.current = setTimeout(() => setScene(s => (s + 1) % STAGES.length), STEP_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [scene])

  function replay() {
    if (timer.current) clearTimeout(timer.current)
    setScene(0)
  }

  const isPlaybook = scene === 2
  const hubActive = scene >= 1
  const Badge = STAGES[scene].icon

  // Pulse travels Assess→Notify but DWELLS at the Approval gate (the hero moment).
  const flowPath = `M ${FLOW[0].x} ${FLOW_Y} L ${FLOW[1].x} ${FLOW_Y} L ${FLOW[2].x} ${FLOW_Y} L ${FLOW[3].x} ${FLOW_Y} L ${FLOW[4].x} ${FLOW_Y}`

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[oklch(0.07_0.02_268)] text-white">
      <CosmicBackground autoSpin />

      <div className="relative z-10 h-full w-full flex flex-col">
        <div className="text-center pt-8 pb-1 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">How OrbitAPI works</h1>
          <p className="text-white/45 text-sm mt-1">Connect → automate with Skills → orchestrate with Playbooks.</p>
        </div>

        {/* Stage progression */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 shrink-0">
          {STAGES.map((s, i) => {
            const I = s.icon
            const active = i === scene
            const done = i < scene
            return (
              <div key={s.badge} className="flex items-center gap-2 sm:gap-3">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all duration-300 ${
                  active ? 'border-[oklch(0.66_0.2_274)] bg-[oklch(0.46_0.19_264)]/25 text-white'
                  : done ? 'border-emerald-500/30 text-emerald-300/80'
                  : 'border-white/10 text-white/40'
                }`}>
                  <I className="h-3.5 w-3.5" /> {s.badge}
                </div>
                {i < STAGES.length - 1 && <span className={`text-xs ${i < scene ? 'text-emerald-400/60' : 'text-white/20'}`}>→</span>}
              </div>
            )
          })}
        </div>

        {/* Diagram */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-4">
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-full max-w-5xl" style={{ maxHeight: '64vh' }}>
            <defs>
              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.6 0.2 274)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="oklch(0.6 0.2 274)" stopOpacity="0" />
              </radialGradient>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.7 0.12 274 / 70%)" />
              </marker>
            </defs>

            {/* ─── Orbital view (stages 1 & 2) — dims behind the playbook flow ─── */}
            <g style={{ transition: 'opacity 0.6s' }} opacity={isPlaybook ? 0.14 : 1}>
              <circle cx={HUB.x} cy={HUB.y} r={APP_RADIUS} fill="none" stroke="oklch(0.6 0.12 274 / 16%)" strokeWidth="1" strokeDasharray="3 6" />
              <line x1={TRIGGER.x} y1={TRIGGER.y} x2={HUB.x} y2={HUB.y} stroke="oklch(0.7 0.16 274 / 40%)" strokeWidth="1.5" pathLength={1} className="spoke" style={{ animationDelay: '0.1s' }} />
              {APPS.map((a, i) => (
                <line key={a.slug} x1={HUB.x} y1={HUB.y} x2={a.x} y2={a.y} stroke="oklch(0.6 0.1 274 / 30%)" strokeWidth="1.5" pathLength={1} className="spoke" style={{ animationDelay: `${0.25 + i * 0.08}s` }} />
              ))}

              {scene === 0 && APPS.map((a, i) => (
                <Pulse key={a.slug} sx={HUB.x} sy={HUB.y} ex={a.x} ey={a.y} color="oklch(0.78 0.14 274)" begin={`${i * 0.12}s`} dur="1.1s" />
              ))}
              {scene === 1 && (
                <>
                  <Pulse sx={TRIGGER.x} sy={TRIGGER.y} ex={HUB.x} ey={HUB.y} color="oklch(0.8 0.16 274)" dur="1.2s" />
                  <Pulse sx={HUB.x} sy={HUB.y} ex={APPS[2].x} ey={APPS[2].y} color="oklch(0.82 0.14 200)" begin="0.6s" dur="1s" />
                  <Pulse sx={HUB.x} sy={HUB.y} ex={APPS[4].x} ey={APPS[4].y} color="oklch(0.82 0.14 200)" begin="0.75s" dur="1s" />
                  <Pulse sx={HUB.x} sy={HUB.y} ex={TRIGGER.x} ey={TRIGGER.y} color="oklch(0.82 0.18 150)" begin="1.7s" dur="1.1s" />
                </>
              )}

              {/* Trigger node */}
              <g className="transition-opacity duration-300" opacity={scene === 1 ? 1 : 0.55}>
                <circle cx={TRIGGER.x} cy={TRIGGER.y} r="34" fill="oklch(0.16 0.03 274)" stroke={scene === 1 ? 'oklch(0.72 0.18 274)' : 'oklch(0.5 0.1 274 / 50%)'} strokeWidth="2" />
                <foreignObject x={TRIGGER.x - 22} y={TRIGGER.y - 22} width="44" height="44">
                  <div className="h-full w-full flex items-center justify-center"><MessageSquare className="h-5 w-5 text-[oklch(0.78_0.16_274)]" /></div>
                </foreignObject>
                <text x={TRIGGER.x} y={TRIGGER.y + 54} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">You ask</text>
                <text x={TRIGGER.x} y={TRIGGER.y + 71} textAnchor="middle" fill="oklch(0.7 0.02 274)" fontSize="10.5">or schedule / event</text>
              </g>

              {scene === 1 && (
                <foreignObject x={20} y={150} width={210} height={66} className="animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="rounded-2xl rounded-bl-sm bg-[oklch(0.46_0.19_264)] text-white text-[11px] leading-snug px-3 py-2 shadow-lg">
                    &ldquo;Every morning, summarize overnight threats and post to Slack&rdquo;
                  </div>
                </foreignObject>
              )}

              {/* Hub */}
              <circle cx={HUB.x} cy={HUB.y} r={HUB.r + 36} fill="url(#hubGlow)" className="transition-opacity duration-500" opacity={hubActive ? 1 : 0.35} />
              {hubActive && !isPlaybook && (
                <circle cx={HUB.x} cy={HUB.y} r={HUB.r} fill="none" stroke="oklch(0.7 0.2 274)" strokeWidth="2">
                  <animate attributeName="r" values={`${HUB.r};${HUB.r + 22}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={HUB.x} cy={HUB.y} r={HUB.r} fill="oklch(0.2 0.05 274)" stroke="oklch(0.66 0.2 274)" strokeWidth="2.5" />
              <foreignObject x={HUB.x - HUB.r} y={HUB.y - HUB.r} width={HUB.r * 2} height={HUB.r * 2}>
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-[oklch(0.78_0.16_274)]" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <ellipse cx="12" cy="12" rx="10" ry="4.5" />
                    <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
                  </svg>
                  <span className="text-[11px] font-bold text-white leading-none mt-1">Orbit AI</span>
                </div>
              </foreignObject>

              {/* App nodes */}
              {APPS.map(a => (
                <g key={a.slug}>
                  <circle cx={a.x} cy={a.y} r="28" fill="oklch(0.15 0.025 274)" stroke={scene >= 1 ? 'oklch(0.66 0.14 274 / 60%)' : 'oklch(0.5 0.08 274 / 40%)'} strokeWidth="2" style={{ transition: 'stroke 0.4s' }} />
                  <image href={`/logos/${a.slug}.svg`} x={a.x - 15} y={a.y - 15} width="30" height="30" preserveAspectRatio="xMidYMid slice" clipPath="inset(0% round 6px)" />
                  <text x={a.x} y={a.y + 44} textAnchor="middle" fill="oklch(0.78 0.02 274)" fontSize="11">{a.label}</text>
                </g>
              ))}
              <text x={HUB.x + 26} y={HUB.y - APP_RADIUS + 2} textAnchor="middle" fill="oklch(0.6 0.02 274)" fontSize="11">+ 100 more apps</text>

              {scene === 1 && (
                <g className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: '1.6s' }}>
                  <circle cx={TRIGGER.x + 26} cy={TRIGGER.y - 26} r="13" fill="oklch(0.55 0.18 150)" />
                  <foreignObject x={TRIGGER.x + 18} y={TRIGGER.y - 34} width="16" height="16">
                    <div className="h-full w-full flex items-center justify-center"><Check className="h-3.5 w-3.5 text-white" /></div>
                  </foreignObject>
                </g>
              )}

              {!isPlaybook && (
                <foreignObject x={HUB.x - 60} y={HUB.y + HUB.r + 10} width={120} height={28}>
                  <div className="flex items-center justify-center">
                    <span key={scene} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[oklch(0.46_0.19_264)]/30 border border-[oklch(0.6_0.18_274)]/40 text-[11px] font-semibold text-white animate-in fade-in zoom-in duration-300">
                      <Badge className="h-3 w-3" /> {STAGES[scene].badge}
                    </span>
                  </div>
                </foreignObject>
              )}
            </g>

            {/* ─── Playbook flow (stage 3) ─────────────────────────────────── */}
            {isPlaybook && (
              <g className="animate-in fade-in duration-500">
                {/* trigger label */}
                <text x={FLOW[0].x} y={FLOW_Y - 64} textAnchor="middle" fill="oklch(0.7 0.02 274)" fontSize="11">event / schedule</text>

                {/* connecting arrows */}
                {FLOW.slice(0, -1).map((n, i) => (
                  <line key={n.key} x1={n.x + CHIP_W / 2} y1={FLOW_Y} x2={FLOW[i + 1].x - CHIP_W / 2 - 4} y2={FLOW_Y}
                    stroke="oklch(0.7 0.12 274 / 60%)" strokeWidth="2" markerEnd="url(#arrow)" />
                ))}
                {/* "high severity" label between Decide and Approve */}
                <text x={(FLOW[1].x + FLOW[2].x) / 2} y={FLOW_Y - 12} textAnchor="middle" fill="oklch(0.82 0.14 60)" fontSize="10.5" fontWeight="600">high</text>

                {/* low-severity branch: Decide → Notify(low) */}
                <path d={`M ${FLOW[1].x} ${FLOW_Y + 38} L ${FLOW[1].x} ${380 - 36}`} stroke="oklch(0.6 0.1 274 / 55%)" strokeWidth="2" markerEnd="url(#arrow)" fill="none" />
                <text x={FLOW[1].x + 46} y={FLOW_Y + 70} textAnchor="middle" fill="oklch(0.7 0.02 274)" fontSize="10.5">low → just notify</text>
                <FlowChip cx={FLOW[1].x} cy={380} label="Notify" hint="all clear" icon={Bell} />

                {/* main flow chips */}
                {FLOW.map(n => (
                  <FlowChip key={n.key} cx={n.x} cy={FLOW_Y} label={n.label} hint={n.hint} icon={n.icon}
                    highlight={n.key === 'approve'} />
                ))}

                {/* app logos under the Act step — it acts across your apps */}
                {['crowdstrike', 'pagerduty', 'slack'].map((slug, i) => (
                  <g key={slug}>
                    <line x1={FLOW[3].x - 30 + i * 30} y1={FLOW_Y + 38} x2={FLOW[3].x - 30 + i * 30} y2={FLOW_Y + 60} stroke="oklch(0.6 0.1 274 / 40%)" strokeWidth="1.5" />
                    <image href={`/logos/${slug}.svg`} x={FLOW[3].x - 40 + i * 30} y={FLOW_Y + 60} width="20" height="20" preserveAspectRatio="xMidYMid slice" clipPath="inset(0% round 4px)" />
                  </g>
                ))}

                {/* approval gate emphasis */}
                <circle cx={FLOW[2].x} cy={FLOW_Y} r="44" fill="none" stroke="oklch(0.82 0.16 60)" strokeWidth="2" opacity="0.7">
                  <animate attributeName="r" values="40;52" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
                </circle>

                {/* travelling pulse — dwells at the Approval gate */}
                <circle r="6.5" fill="oklch(0.85 0.16 200)">
                  <animateMotion dur="3.6s" repeatCount="indefinite" path={flowPath}
                    keyPoints="0;0.5;0.5;1" keyTimes="0;0.38;0.6;1" calcMode="linear" />
                </circle>

                {/* severity callout */}
                <foreignObject x={FLOW[2].x - 95} y={FLOW_Y - 110} width={190} height={44}>
                  <div className="text-center text-[11px] text-[oklch(0.85_0.13_60)] leading-snug">
                    ⏸ Pauses for your approval<br />when the AI isn’t sure
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>
        </div>

        {/* Caption + progress dots */}
        <div className="shrink-0 pb-10 px-6">
          <div className="max-w-2xl mx-auto text-center min-h-[3.5rem] flex items-center justify-center">
            <p key={scene} className="text-lg sm:text-xl text-white/85 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {STAGES[scene].caption}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mt-5">
            {STAGES.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === scene ? 'w-8 bg-[oklch(0.7_0.2_274)]' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute left-5 bottom-5 z-20 hidden sm:flex flex-col gap-1.5 text-[11px] text-white/40">
        {[{ i: MessageSquare, t: 'You ask in chat' }, { i: Clock, t: 'On a schedule' }, { i: Webhook, t: 'A webhook / event' }].map(({ i: I, t }) => (
          <span key={t} className="flex items-center gap-1.5"><I className="h-3 w-3" /> {t}</span>
        ))}
      </div>

      <button onClick={replay} className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium backdrop-blur transition-colors opacity-50 hover:opacity-100" title="Replay">
        <RotateCcw className="h-3.5 w-3.5" /> Replay
      </button>

      <style>{`
        .spoke { stroke-dasharray: 1; stroke-dashoffset: 1; animation: spoke-draw 0.7s ease forwards; }
        @keyframes spoke-draw { to { stroke-dashoffset: 0 } }
        @media (prefers-reduced-motion: reduce) { .spoke { animation: none; stroke-dashoffset: 0 } }
      `}</style>
    </div>
  )
}

// A playbook step chip rendered in SVG user space (aligns with the animated pulse).
function FlowChip({ cx, cy, label, hint, icon: Icon, highlight = false }: {
  cx: number; cy: number; label: string; hint: string; icon: React.ComponentType<{ className?: string }>; highlight?: boolean
}) {
  const w = CHIP_W, h = 72
  return (
    <foreignObject x={cx - w / 2} y={cy - h / 2} width={w} height={h}>
      <div className={`h-full w-full rounded-xl border flex flex-col items-center justify-center text-center px-2 ${
        highlight ? 'border-[oklch(0.82_0.16_60)]/70 bg-[oklch(0.3_0.08_60)]/40' : 'border-[oklch(0.6_0.16_274)]/40 bg-[oklch(0.16_0.03_274)]/90'
      }`}>
        <Icon className={`h-4 w-4 ${highlight ? 'text-[oklch(0.85_0.15_60)]' : 'text-[oklch(0.78_0.16_274)]'}`} />
        <span className="text-[12px] font-bold text-white leading-tight mt-1">{label}</span>
        <span className="text-[9.5px] text-white/55 leading-tight">{hint}</span>
      </div>
    </foreignObject>
  )
}

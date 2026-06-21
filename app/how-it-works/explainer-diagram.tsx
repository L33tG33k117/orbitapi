'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Clock, Webhook, Check, RotateCcw } from 'lucide-react'
import { CosmicBackground } from '@/components/cosmic-background'

// A live concept diagram of how OrbitAPI works. A command flows in from a
// trigger → the Orbit hub interprets it → it calls the connected apps (pulses
// travel out along the orbital spokes) → results return to the hub. A caption
// narrates each step. Loops. Built to be watched/recorded as a "how it works"
// explainer — the mechanics, not marketing copy.

// ── Geometry (SVG user space) ──────────────────────────────────────────────
const VB = { w: 960, h: 540 }
const HUB = { x: 400, y: 270, r: 54 }
const TRIGGER = { x: 120, y: 270 }

// Connected apps arranged on an arc orbiting the right of the hub.
const APP_RADIUS = 250
const APPS = [
  { slug: 'crowdstrike', label: 'CrowdStrike', deg: -62 },
  { slug: 'netsuite', label: 'NetSuite', deg: -31 },
  { slug: 'slack', label: 'Slack', deg: 0 },
  { slug: 'teams', label: 'Teams', deg: 31 },
  { slug: 'pagerduty', label: 'PagerDuty', deg: 62 },
].map(a => {
  const rad = (a.deg * Math.PI) / 180
  return { ...a, x: Math.round(HUB.x + APP_RADIUS * Math.cos(rad)), y: Math.round(HUB.y + APP_RADIUS * Math.sin(rad)) }
})

const STEPS = [
  { caption: 'You give a command — in plain English, on a schedule, or from an event.' },
  { caption: 'Orbit reads your intent and figures out which apps and actions are needed.' },
  { caption: 'It calls each connected API and chains the steps — across every app at once.' },
  { caption: 'Results come back to you — and every action is approved & logged.' },
]
const STEP_MS = 2600

// A glowing dot that travels along a straight line from (sx,sy)→(ex,ey),
// repeating while its scene is active. Uses SMIL animateMotion (reliable in SVG).
function Pulse({ sx, sy, ex, ey, color, begin = '0s', dur = '1.1s' }: {
  sx: number; sy: number; ex: number; ey: number; color: string; begin?: string; dur?: string
}) {
  return (
    <circle r="5.5" fill={color} opacity="0">
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={`M ${sx} ${sy} L ${ex} ${ey}`} />
      <animate attributeName="opacity" dur={dur} begin={begin} repeatCount="indefinite"
        keyTimes="0;0.15;0.85;1" values="0;1;1;0" />
    </circle>
  )
}

export function ExplainerDiagram() {
  const [scene, setScene] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timer.current = setTimeout(() => setScene(s => (s + 1) % STEPS.length), STEP_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [scene])

  function replay() {
    if (timer.current) clearTimeout(timer.current)
    setScene(0)
  }

  const hubActive = scene >= 1
  const appsActive = scene >= 2

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[oklch(0.07_0.02_268)] text-white">
      <CosmicBackground autoSpin />

      <div className="relative z-10 h-full w-full flex flex-col">
        {/* Title */}
        <div className="text-center pt-8 pb-2 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">How OrbitAPI works</h1>
          <p className="text-white/45 text-sm mt-1">One command. Every connected app. Automatically.</p>
        </div>

        {/* Diagram */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-4">
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-full max-w-5xl" style={{ maxHeight: '70vh' }}>
            <defs>
              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.6 0.2 274)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="oklch(0.6 0.2 274)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Orbit ring through the app nodes */}
            <circle cx={HUB.x} cy={HUB.y} r={APP_RADIUS} fill="none"
              stroke="oklch(0.6 0.12 274 / 18%)" strokeWidth="1" strokeDasharray="3 6" />

            {/* Spokes: trigger → hub, hub → each app (drawn-in on load) */}
            <line x1={TRIGGER.x} y1={TRIGGER.y} x2={HUB.x} y2={HUB.y}
              stroke="oklch(0.7 0.16 274 / 45%)" strokeWidth="1.5"
              pathLength={1} className="spoke" style={{ animationDelay: '0.1s' }} />
            {APPS.map((a, i) => (
              <line key={a.slug} x1={HUB.x} y1={HUB.y} x2={a.x} y2={a.y}
                stroke={appsActive ? 'oklch(0.72 0.16 274 / 60%)' : 'oklch(0.6 0.1 274 / 28%)'}
                strokeWidth="1.5" pathLength={1} className="spoke"
                style={{ animationDelay: `${0.3 + i * 0.08}s`, transition: 'stroke 0.4s' }} />
            ))}

            {/* Pulses: scene 0 → trigger to hub; scene 2 → hub to apps; scene 3 → apps back to hub */}
            {scene === 0 && (
              <Pulse sx={TRIGGER.x} sy={TRIGGER.y} ex={HUB.x} ey={HUB.y} color="oklch(0.8 0.16 274)" />
            )}
            {scene === 2 && APPS.map((a, i) => (
              <Pulse key={a.slug} sx={HUB.x} sy={HUB.y} ex={a.x} ey={a.y}
                color="oklch(0.82 0.14 200)" begin={`${i * 0.14}s`} dur="1s" />
            ))}
            {scene === 3 && APPS.map((a, i) => (
              <Pulse key={a.slug} sx={a.x} sy={a.y} ex={HUB.x} ey={HUB.y}
                color="oklch(0.82 0.18 150)" begin={`${i * 0.1}s`} dur="0.95s" />
            ))}

            {/* Trigger node */}
            <g className="transition-opacity duration-300" opacity={scene === 0 ? 1 : 0.6}>
              <circle cx={TRIGGER.x} cy={TRIGGER.y} r="34"
                fill="oklch(0.16 0.03 274)" stroke={scene === 0 ? 'oklch(0.72 0.18 274)' : 'oklch(0.5 0.1 274 / 50%)'} strokeWidth="2" />
              <foreignObject x={TRIGGER.x - 22} y={TRIGGER.y - 22} width="44" height="44">
                <div className="h-full w-full flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-[oklch(0.78_0.16_274)]" />
                </div>
              </foreignObject>
              <text x={TRIGGER.x} y={TRIGGER.y + 54} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">You ask</text>
              <text x={TRIGGER.x} y={TRIGGER.y + 72} textAnchor="middle" fill="oklch(0.7 0.02 274)" fontSize="10.5">or schedule / event</text>
            </g>

            {/* Hub */}
            <circle cx={HUB.x} cy={HUB.y} r={HUB.r + 36} fill="url(#hubGlow)"
              className="transition-opacity duration-500" opacity={hubActive ? 1 : 0.35} />
            {hubActive && (
              <circle cx={HUB.x} cy={HUB.y} r={HUB.r} fill="none" stroke="oklch(0.7 0.2 274)" strokeWidth="2">
                <animate attributeName="r" values={`${HUB.r};${HUB.r + 22}`} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={HUB.x} cy={HUB.y} r={HUB.r}
              fill="oklch(0.2 0.05 274)" stroke="oklch(0.66 0.2 274)" strokeWidth="2.5" />
            <foreignObject x={HUB.x - HUB.r} y={HUB.y - HUB.r} width={HUB.r * 2} height={HUB.r * 2}>
              <div className="h-full w-full flex flex-col items-center justify-center gap-0.5">
                {/* Orbit mark */}
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-[oklch(0.78_0.16_274)]" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <ellipse cx="12" cy="12" rx="10" ry="4.5" />
                  <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
                </svg>
                <span className="text-[11px] font-bold text-white leading-none mt-0.5">Orbit AI</span>
              </div>
            </foreignObject>
            <text x={HUB.x} y={HUB.y + HUB.r + 22} textAnchor="middle" fill="oklch(0.72 0.04 274)" fontSize="11">understands intent</text>

            {/* App nodes */}
            {APPS.map(a => (
              <g key={a.slug} className="transition-opacity duration-500" opacity={appsActive ? 1 : 0.4}>
                <circle cx={a.x} cy={a.y} r="28"
                  fill="oklch(0.15 0.025 274)"
                  stroke={appsActive ? 'oklch(0.7 0.16 274 / 70%)' : 'oklch(0.5 0.08 274 / 40%)'} strokeWidth="2" />
                <image href={`/logos/${a.slug}.svg`} x={a.x - 15} y={a.y - 15} width="30" height="30"
                  preserveAspectRatio="xMidYMid slice" clipPath="inset(0% round 6px)" />
                <text x={a.x} y={a.y + 44} textAnchor="middle" fill="oklch(0.78 0.02 274)" fontSize="11">{a.label}</text>
              </g>
            ))}
            <text x={HUB.x + 30} y={HUB.y - APP_RADIUS + 4} textAnchor="middle" fill="oklch(0.6 0.02 274)" fontSize="11">+ 100 more apps</text>

            {/* Result check — scene 3 */}
            {scene === 3 && (
              <g className="animate-in fade-in zoom-in duration-500">
                <circle cx={TRIGGER.x} cy={TRIGGER.y} r="16" fill="oklch(0.55 0.18 150)" />
                <foreignObject x={TRIGGER.x - 10} y={TRIGGER.y - 10} width="20" height="20">
                  <div className="h-full w-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>
        </div>

        {/* Step caption + dots */}
        <div className="shrink-0 pb-10 px-6">
          <div className="max-w-2xl mx-auto text-center min-h-[3.5rem] flex items-center justify-center">
            <p key={scene} className="text-lg sm:text-xl text-white/85 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span className="text-[oklch(0.78_0.16_274)] font-bold mr-2">{scene + 1}.</span>
              {STEPS[scene].caption}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mt-5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === scene ? 'w-8 bg-[oklch(0.7_0.2_274)]' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Trigger-type legend (what "you ask" can be) */}
      <div className="absolute left-5 bottom-5 z-20 hidden sm:flex flex-col gap-1.5 text-[11px] text-white/40">
        {[{ i: MessageSquare, t: 'You ask in chat' }, { i: Clock, t: 'On a schedule' }, { i: Webhook, t: 'A webhook / event' }].map(({ i: I, t }) => (
          <span key={t} className="flex items-center gap-1.5"><I className="h-3 w-3" /> {t}</span>
        ))}
      </div>

      <button
        onClick={replay}
        className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium backdrop-blur transition-colors opacity-50 hover:opacity-100"
        title="Replay"
      >
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

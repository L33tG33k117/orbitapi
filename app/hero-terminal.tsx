'use client'

import { useEffect, useRef, useState } from 'react'
import { Banknote, ShieldAlert, Headset, Lightbulb, Orbit, ArrowRight, ScrollText } from 'lucide-react'

// Interactive hero terminal: the visitor picks a mission and watches the
// conversation play out. Scripted (zero backend cost) but every scenario
// mirrors what the product genuinely does — including the approval pause
// on destructive actions, which is a selling point, not a caveat.

type Chip = { label: string; tone: 'violet' | 'blue' | 'purple' | 'green' | 'amber' }
type Event =
  | { kind: 'chips'; chips: Chip[] }
  | { kind: 'text'; html: string }
  | { kind: 'done'; text: string }

interface Scenario {
  id: string
  tab: string
  icon: typeof Banknote
  prompt: string
  events: Event[]
}

const CHIP_TONES: Record<Chip['tone'], string> = {
  violet: 'bg-[oklch(0.46_0.19_264)]/15 border-[oklch(0.46_0.19_264)]/20 text-[oklch(0.72_0.18_264)]',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
}

const DOT_TONES: Record<Chip['tone'], string> = {
  violet: 'bg-[oklch(0.7_0.2_264)]',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  green: 'bg-green-400',
  amber: 'bg-amber-400',
}

const SCENARIOS: Scenario[] = [
  {
    id: 'finance',
    tab: 'Finance',
    icon: Banknote,
    prompt: 'Let me know when a NetSuite invoice ages past 10 days overdue so collections can reach out — email me and post to Teams',
    events: [
      { kind: 'chips', chips: [{ label: 'Querying NetSuite → list_open_invoices', tone: 'violet' }] },
      { kind: 'text', html: '<strong class="text-white">3 invoices</strong> just crossed 10 days past due — Acme Corp ($120k, 14d overdue), TechVentures ($89k, 12d), GlobalSystems ($38.8k, 11d). Time for collections to reach out.' },
      { kind: 'chips', chips: [
        { label: 'Emailing collections → send_alert_email', tone: 'blue' },
        { label: 'Posting to Teams → send_alert', tone: 'purple' },
      ] },
      { kind: 'done', text: '✓ Email sent · Teams channel notified · 3 actions across 3 APIs in 2.3s' },
    ],
  },
  {
    id: 'security',
    tab: 'Security',
    icon: ShieldAlert,
    prompt: 'Any critical detections overnight? Contain affected hosts and open an incident for each',
    events: [
      { kind: 'chips', chips: [{ label: 'Querying CrowdStrike → list_detections', tone: 'violet' }] },
      { kind: 'text', html: '<strong class="text-white">2 critical detections</strong> since 11 PM — credential theft on LAPTOP-7F2 and lateral movement from 10.0.4.18.' },
      { kind: 'chips', chips: [
        { label: '⏸ contain_host → queued for your approval', tone: 'amber' },
        { label: 'Creating ServiceNow → create_incident ×2', tone: 'blue' },
      ] },
      { kind: 'done', text: '✓ 2 incidents opened · containment awaiting one-tap approval — nothing destructive runs without you' },
    ],
  },
  {
    id: 'support',
    tab: 'Support',
    icon: Headset,
    prompt: 'Find Zendesk tickets about to breach SLA, draft replies, and post a summary to Slack',
    events: [
      { kind: 'chips', chips: [{ label: 'Querying Zendesk → search_tickets', tone: 'violet' }] },
      { kind: 'text', html: '<strong class="text-white">4 tickets</strong> breach SLA within 2 hours — two billing, one login outage, one refund request.' },
      { kind: 'chips', chips: [
        { label: 'Drafting replies → add_ticket_comment ×4', tone: 'blue' },
        { label: 'Posting to Slack → send_message', tone: 'purple' },
      ] },
      { kind: 'done', text: '✓ 4 drafts ready for agent review · #support-escalations notified · SLA saved' },
    ],
  },
  {
    id: 'facility',
    tab: 'Smart office',
    icon: Lightbulb,
    prompt: "It's past 10 PM — turn off every light in the office and text me if any device doesn't respond",
    events: [
      { kind: 'chips', chips: [{ label: 'Querying Smart Lights → list_devices', tone: 'violet' }] },
      { kind: 'text', html: '<strong class="text-white">12 lights</strong> found across 3 rooms — 9 still on.' },
      { kind: 'chips', chips: [
        { label: 'Switching off → set_power ×9', tone: 'green' },
        { label: 'Twilio on standby → send_sms', tone: 'purple' },
      ] },
      { kind: 'done', text: '✓ 9 lights off · all devices responded · no SMS needed — goodnight' },
    ],
  },
]

// One reveal step every REVEAL_MS; tab switch restarts the reel.
const REVEAL_MS = 1100

export function HeroTerminal() {
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scenario = SCENARIOS[active]

  useEffect(() => {
    setShown(0)
    timer.current = setInterval(() => {
      setShown(s => {
        if (s + 1 >= SCENARIOS[active].events.length) {
          if (timer.current) clearInterval(timer.current)
          return SCENARIOS[active].events.length
        }
        return s + 1
      })
    }, REVEAL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [active])

  const finished = shown >= scenario.events.length

  return (
    <div className="max-w-3xl mx-auto mt-16">
      {/* Mission picker */}
      <div className="flex items-center justify-center gap-2 flex-wrap mb-4" role="tablist" aria-label="Example missions">
        {SCENARIOS.map((s, i) => {
          const Icon = s.icon
          const selected = i === active
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                selected
                  ? 'border-[oklch(0.46_0.19_264)]/60 bg-[oklch(0.46_0.19_264)]/20 text-white'
                  : 'border-white/10 text-white/45 hover:text-white/80 hover:border-white/25'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {s.tab}
            </button>
          )
        })}
      </div>

      {/* The actual app on a laptop — same friendly chat you'll really use */}
      <div className="relative animate-float">
        <div className="rounded-t-2xl border border-white/12 border-b-0 bg-[oklch(0.09_0.018_268)] overflow-hidden shadow-2xl shadow-black/60">
          {/* Browser chrome */}
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

          <div className="flex min-h-[300px]">
            {/* Mini sidebar — outlines the real OrbitAPI shell */}
            <div className="hidden sm:flex flex-col items-center gap-1 w-11 py-3 border-r border-white/8 bg-[oklch(0.075_0.016_268)]">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[oklch(0.46_0.19_264)] to-[oklch(0.4_0.2_290)] flex items-center justify-center mb-2">
                <Orbit className="h-3.5 w-3.5 text-white" />
              </div>
              {[false, true, false, false].map((on, i) => (
                <div key={i} className={`h-6 w-6 rounded-md flex items-center justify-center ${on ? 'bg-[oklch(0.46_0.19_264)]/25' : ''}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-[oklch(0.72_0.18_264)]' : 'bg-white/20'}`} />
                </div>
              ))}
            </div>

            {/* Chat column */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                <span className="text-sm font-semibold flex items-center gap-2"><span className="text-[oklch(0.72_0.18_264)]">✦</span> Orbit Assistant</span>
                <span className="text-[10px] text-white/30 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI Power ready</span>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 space-y-2.5 text-sm">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-[oklch(0.46_0.19_264)] to-[oklch(0.42_0.2_278)] px-3.5 py-2 text-white shadow-lg">
                    {scenario.prompt}
                  </div>
                </div>
                {scenario.events.slice(0, shown).map((ev, i) => {
                  if (ev.kind === 'chips') {
                    return (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[90%] flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-500">
                          {ev.chips.map(c => (
                            <span key={c.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${CHIP_TONES[c.tone]}`}>
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse inline-block shrink-0 ${DOT_TONES[c.tone]}`} />
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  if (ev.kind === 'text') {
                    return (
                      <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-500">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/8 px-3.5 py-2 text-white/80" dangerouslySetInnerHTML={{ __html: ev.html }} />
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-500">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 text-emerald-200/90">{ev.text}</div>
                    </div>
                  )
                })}
                {!finished && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/8 px-3 py-2.5 flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="p-3 border-t border-white/8 flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-white/30">Ask anything about your connected apps…</div>
                <div className="h-9 w-9 rounded-xl bg-[oklch(0.46_0.19_264)] text-white flex items-center justify-center shrink-0"><ArrowRight className="h-4 w-4" /></div>
              </div>
            </div>
          </div>

          <div className="px-4 py-2 border-t border-white/8 bg-[oklch(0.07_0.016_268)] flex items-center gap-2 text-[10px] text-white/35">
            <ScrollText className="h-3 w-3" /> every action lands in a searchable, replayable audit trail
          </div>
        </div>
        {/* Laptop base */}
        <div className="h-2.5 rounded-b-md bg-gradient-to-b from-[oklch(0.17_0.02_268)] to-[oklch(0.1_0.018_268)] border-x border-b border-white/12" />
        <div className="mx-auto h-1.5 w-2/5 rounded-b-xl bg-[oklch(0.13_0.02_268)] shadow-lg" />
      </div>

      <p className="mt-5 text-center text-xs text-white/35">
        Not a mockup — every connector has a Simulated mode, so these exact conversations work before you hand over a single API key.
      </p>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Orbit, Zap, Shield, ArrowRight, CheckCircle,
  Plug, MessageSquare, Radio, Satellite, Globe2, Rocket,
  ShieldAlert, Package, Webhook, Shuffle, ScrollText, Clock, Gauge, ClipboardCheck,
} from 'lucide-react'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">

      {/* ── Stars background ────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35) 0%, transparent 100%),
              radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.25) 0%, transparent 100%),
              radial-gradient(1px 1px at 50% 60%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 90% 70%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 35% 15%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 65% 85%, rgba(255,255,255,0.25) 0%, transparent 100%),
              radial-gradient(1px 1px at 75% 45%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 15% 55%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 55% 25%, rgba(255,255,255,0.35) 0%, transparent 100%)`,
          }}
        />
        {/* Nebula glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse at center, oklch(0.46 0.19 264) 0%, transparent 70%)' }} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-md bg-[oklch(0.07_0.02_268)]/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
              <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">OrbitAPI</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/50">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[oklch(0.46_0.19_264)] text-white text-sm font-medium hover:bg-[oklch(0.52_0.2_264)] transition-colors"
            >
              Launch free <Rocket className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 sm:pt-40 sm:pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[oklch(0.46_0.19_264)]/40 bg-[oklch(0.46_0.19_264)]/10 text-[oklch(0.75_0.18_264)] text-xs font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.2_264)] animate-pulse inline-block" />
            100+ integrations now in orbit
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Every API in{' '}
            <span className="bg-gradient-to-r from-[oklch(0.72_0.18_264)] via-[oklch(0.76_0.16_240)] to-[oklch(0.78_0.12_200)] bg-clip-text text-transparent">
              your orbit
            </span>
          </h1>
          <p className="mt-6 text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">
            OrbitAPI is your mission control for the modern tech stack. Connect security tools, ERP systems,
            communication platforms, and IoT devices — then command them all with plain English or
            autonomous AI workflows.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Begin your mission <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-medium text-base transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Hero terminal mockup */}
        <div className="max-w-3xl mx-auto mt-20 rounded-2xl border border-white/10 bg-[oklch(0.09_0.018_268)] overflow-hidden shadow-2xl shadow-black/60">
          <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/8 bg-[oklch(0.11_0.02_268)]">
            <span className="h-3 w-3 rounded-full bg-red-500/60" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="ml-4 text-xs text-white/30 font-mono">Orbit Assistant — Mission Control</span>
          </div>
          <div className="p-6 space-y-5 text-sm font-mono">
            <div className="flex gap-3 items-start">
              <span className="text-[oklch(0.7_0.2_264)] shrink-0 mt-0.5">you</span>
              <span className="text-[oklch(0.7_0.2_264)] shrink-0 mt-0.5">→</span>
              <span className="text-white/80">Show open critical invoices in NetSuite over $50k, then email me a summary and post to Teams</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-green-400 shrink-0 mt-0.5 font-semibold">orbit</span>
              <span className="text-green-400 shrink-0 mt-0.5">→</span>
              <div className="text-white/70 space-y-2.5 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[oklch(0.46_0.19_264)]/15 border border-[oklch(0.46_0.19_264)]/20 text-[oklch(0.72_0.18_264)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.2_264)] animate-pulse inline-block" />
                    Querying NetSuite → list_open_invoices
                  </span>
                </div>
                <p className="text-white/75">Found <strong className="text-white">3 invoices</strong> — $247,800 total. Acme Corp ($120k, 14d overdue), TechVentures ($89k, 7d), GlobalSystems ($38.8k, 3d).</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                    Sending via SendGrid → send_alert_email
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
                    Posting to Teams → send_alert
                  </span>
                </div>
                <p className="text-green-400">✓ Email sent · Teams channel notified · 3 actions across 3 APIs in 2.3s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connector logos strip */}
        <div className="max-w-3xl mx-auto mt-10 flex items-center justify-center gap-3 flex-wrap">
          {['crowdstrike', 'netsuite', 'servicenow', 'slack', 'teams', 'sendgrid', 'twilio', 'pagerduty'].map(slug => (
            <div key={slug} className="h-8 w-8 rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity" title={slug}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${slug}.svg`} alt={slug} className="h-full w-full object-cover" />
            </div>
          ))}
          <span className="text-xs text-white/30 ml-1">+ 95 more</span>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 border-t border-white/6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Radio className="h-3 w-3" /> Mission briefing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">Ground control in three steps</h2>
            <p className="mt-3 text-white/50 text-base max-w-xl mx-auto">
              From zero to full API automation in minutes — no code required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                step: '01',
                icon: Plug,
                title: 'Connect your APIs',
                desc: 'Browse 100+ pre-built connectors. Pick the tools you use — security, ERP, communication, cloud — and connect them in one click with guided credential setup.',
                color: 'text-[oklch(0.7_0.2_264)]',
                bg: 'bg-[oklch(0.46_0.19_264)]/10 border-[oklch(0.46_0.19_264)]/20',
              },
              {
                step: '02',
                icon: MessageSquare,
                title: 'Command in plain English',
                desc: 'Ask Orbit Assistant anything about your connected systems. It translates your intent into API calls, chains multiple services, and returns clear answers — not raw JSON.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
              },
              {
                step: '03',
                icon: Satellite,
                title: 'Launch autonomous skills',
                desc: 'Turn any workflow into an AI skill. Set it to run on a schedule, react to webhooks, or poll continuously. It runs cross-API missions automatically — you just review the results.',
                color: 'text-green-400',
                bg: 'bg-green-500/10 border-green-500/20',
              },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={item.step} className="relative">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-10 right-0 translate-x-1/2 z-10">
                      <ArrowRight className="h-5 w-5 text-white/15" />
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-7 h-full space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${item.bg}`}>
                        <Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <span className="text-3xl font-black text-white/8">{item.step}</span>
                    </div>
                    <h3 className="font-bold text-lg">{item.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Demo walkthrough mockup */}
          <div className="rounded-2xl border border-white/10 bg-[oklch(0.09_0.018_268)] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-[oklch(0.11_0.02_268)]">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <span className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-white/25 font-mono">OrbitAPI — Security Operations Skill</span>
              <div className="w-16" />
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/8">
              {/* Skill config panel */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">Skill configuration</p>
                <div className="space-y-3">
                  <div className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5">
                    <p className="text-xs text-white/30">Name</p>
                    <p className="text-sm text-white font-medium mt-0.5">Security Incident Response</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5">
                    <p className="text-xs text-white/30">Connections in scope</p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {['CrowdStrike', 'ServiceNow', 'Teams'].map(c => (
                        <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-[oklch(0.46_0.19_264)]/15 text-[oklch(0.72_0.18_264)] border border-[oklch(0.46_0.19_264)]/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5">
                    <p className="text-xs text-white/30">Mode</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                      <p className="text-sm text-white font-medium">Autonomous · polls every 5 min</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Live run output */}
              <div className="p-6 space-y-3 font-mono text-xs">
                <p className="text-white/30 uppercase tracking-widest font-sans font-semibold text-xs">Live run output</p>
                <div className="space-y-2 text-white/60">
                  <p><span className="text-white/30">09:14:02</span> <span className="text-[oklch(0.7_0.2_264)]">→</span> CrowdStrike: checking detections…</p>
                  <p><span className="text-white/30">09:14:03</span> <span className="text-amber-400">!</span> Found HIGH severity detection on WIN-SALES-04</p>
                  <p><span className="text-white/30">09:14:03</span> <span className="text-[oklch(0.7_0.2_264)]">→</span> ServiceNow: creating P1 incident…</p>
                  <p><span className="text-white/30">09:14:04</span> <span className="text-green-400">✓</span> INC0042891 created · assigned to SecOps</p>
                  <p><span className="text-white/30">09:14:04</span> <span className="text-[oklch(0.7_0.2_264)]">→</span> CrowdStrike: containing WIN-SALES-04…</p>
                  <p><span className="text-white/30">09:14:05</span> <span className="text-green-400">✓</span> Host isolated from network</p>
                  <p><span className="text-white/30">09:14:05</span> <span className="text-[oklch(0.7_0.2_264)]">→</span> Teams: posting alert to #security-ops…</p>
                  <p><span className="text-white/30">09:14:05</span> <span className="text-green-400">✓</span> Team notified · 3 APIs · 3.1s · zero human input</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Globe2 className="h-3 w-3" /> Systems overview
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">Full-stack mission capabilities</h2>
            <p className="mt-3 text-white/50 text-base max-w-xl mx-auto">
              Everything you need to operate your entire tech stack from a single control center.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: MessageSquare,
                title: 'Orbit Assistant',
                desc: 'Command any connected app in plain English. Ask about open invoices, threat detections, or bookings — Orbit answers with real data and chains actions across APIs, not raw JSON.',
                tag: null,
              },
              {
                icon: ShieldAlert,
                title: 'Autonomous Playbooks',
                desc: 'Multi-step workflows that act on their own — assess severity, take action, and escalate for approval only when it matters. Your always-on operator.',
                tag: 'New',
              },
              {
                icon: Zap,
                title: 'Skills & smart triggers',
                desc: 'Turn any workflow into a reusable skill, then run it on a schedule, from a webhook, or on a real-time event. Set it once; it runs the mission for you.',
                tag: 'New',
              },
              {
                icon: Package,
                title: 'Bundles & Marketplace',
                desc: 'Install ready-made packs of connectors, skills, and playbooks in one click — Security SOC, Support Ops, and more — or publish your own.',
                tag: 'New',
              },
              {
                icon: Shuffle,
                title: 'Cross-API data mapping',
                desc: 'Map fields between apps so data flows automatically — a record in one system becomes the right action in another, no glue code required.',
                tag: 'New',
              },
              {
                icon: ScrollText,
                title: 'Governed by default',
                desc: 'Approvals for risky actions, a complete searchable audit trail, and one-click replay with fresh data. Full visibility into every move, human or AI.',
                tag: null,
              },
            ].map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-6 space-y-3 hover:border-[oklch(0.46_0.19_264)]/40 hover:bg-[oklch(0.11_0.02_268)] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/15">
                      <Icon className="h-5 w-5 text-[oklch(0.7_0.2_264)]" />
                    </div>
                    {f.tag && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[oklch(0.7_0.2_264)]/15 text-[oklch(0.78_0.16_264)]">
                        {f.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Harmony infographic ─────────────────────────────────────────── */}
      <section id="harmony" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Satellite className="h-3 w-3" /> Mission architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">One system, working in harmony</h2>
            <p className="mt-3 text-white/50 text-base max-w-xl mx-auto">
              Whether you ask in chat or let it run on its own, every automation follows the same path —
              and every step is governed.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[oklch(0.09_0.018_268)] p-5 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-stretch gap-3">
              {/* Stage 1 — Trigger */}
              <div className="flex-1 rounded-xl border border-white/8 bg-[oklch(0.11_0.02_268)] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">01 · Trigger</p>
                <h3 className="font-semibold text-sm">Something kicks it off</h3>
                <div className="space-y-1.5">
                  {[
                    { icon: MessageSquare, label: 'You ask in chat' },
                    { icon: Clock, label: 'On a schedule' },
                    { icon: Webhook, label: 'A webhook or event' },
                  ].map(t => {
                    const I = t.icon
                    return (
                      <div key={t.label} className="flex items-center gap-2 text-xs text-white/65 rounded-md bg-white/5 border border-white/8 px-2.5 py-1.5">
                        <I className="h-3.5 w-3.5 text-[oklch(0.72_0.18_264)] shrink-0" /> {t.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center text-white/20">
                <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
              </div>

              {/* Stage 2 — Understand */}
              <div className="flex-1 rounded-xl border border-[oklch(0.46_0.19_264)]/25 bg-[oklch(0.12_0.022_264)] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">02 · Understand</p>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-[oklch(0.46_0.19_264)]/20 flex items-center justify-center">
                    <Orbit className="h-4.5 w-4.5 text-[oklch(0.72_0.18_264)]" />
                  </div>
                  <h3 className="font-semibold text-sm">Orbit reads your intent</h3>
                </div>
                <p className="text-xs text-white/55 leading-relaxed">
                  It figures out exactly which apps and actions are needed — and you choose the horsepower.
                </p>
                <div className="flex items-center gap-2 text-xs text-white/65 rounded-md bg-white/5 border border-white/8 px-2.5 py-1.5">
                  <Gauge className="h-3.5 w-3.5 text-[oklch(0.72_0.18_264)] shrink-0" /> AI Power · Economy → Maximum
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center text-white/20">
                <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
              </div>

              {/* Stage 3 — Automate */}
              <div className="flex-1 rounded-xl border border-white/8 bg-[oklch(0.11_0.02_268)] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">03 · Automate</p>
                <h3 className="font-semibold text-sm">Skills & Playbooks act</h3>
                <div className="space-y-1.5">
                  {[
                    { icon: Zap, label: 'Chains steps across apps' },
                    { icon: ShieldAlert, label: 'Decides & escalates' },
                  ].map(t => {
                    const I = t.icon
                    return (
                      <div key={t.label} className="flex items-center gap-2 text-xs text-white/65 rounded-md bg-white/5 border border-white/8 px-2.5 py-1.5">
                        <I className="h-3.5 w-3.5 text-[oklch(0.72_0.18_264)] shrink-0" /> {t.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center text-white/20">
                <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
              </div>

              {/* Stage 4 — Act */}
              <div className="flex-1 rounded-xl border border-white/8 bg-[oklch(0.11_0.02_268)] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">04 · Act</p>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-green-500/15 flex items-center justify-center">
                    <Plug className="h-4.5 w-4.5 text-green-400" />
                  </div>
                  <h3 className="font-semibold text-sm">Your apps do the work</h3>
                </div>
                <p className="text-xs text-white/55 leading-relaxed">Real actions across every connected API — in seconds.</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['crowdstrike', 'servicenow', 'slack', 'teams', 'netsuite'].map(slug => (
                    <div key={slug} className="h-6 w-6 rounded-md overflow-hidden opacity-70" title={slug}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/logos/${slug}.svg`} alt={slug} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Governance strip */}
            <div className="mt-3 rounded-xl border border-white/8 bg-[oklch(0.08_0.016_268)] px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2 shrink-0">
                  <Shield className="h-4 w-4 text-[oklch(0.72_0.18_264)]" />
                  <span className="text-sm font-semibold">Governed end-to-end</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
                  <span className="flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-white/40" /> Approvals on risky actions</span>
                  <span className="flex items-center gap-1.5"><ScrollText className="h-3.5 w-3.5 text-white/40" /> Complete audit trail</span>
                  <span className="flex items-center gap-1.5"><Satellite className="h-3.5 w-3.5 text-white/40" /> One-click replay & rollback</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Rocket className="h-3 w-3" /> Launch plans
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">Pick your orbit</h2>
            <p className="mt-3 text-white/50 text-base">Start free. Upgrade to full autonomy when you&apos;re ready.</p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[
              {
                name: 'Free',
                badge: null,
                price: '$0',
                period: 'forever',
                desc: 'Explore the universe of APIs — and try the Orbit Assistant for real.',
                features: ['Orbit Assistant — free trial credits', 'Connect up to 3 apps + Simulated mode', '1 Skill (manual runs)', 'Connector groups', 'Audit log'],
                cta: 'Start free',
                href: '/signup',
                highlight: false,
                enterprise: false,
              },
              {
                name: 'Starter',
                badge: null,
                price: '$49',
                period: '/ month',
                desc: 'Unlock AI-powered automation for your whole team.',
                features: ['Everything in Free', 'Unlimited connectors', 'Skills & automations', 'Bundles — ready-made packs', 'Cross-app data mapping', 'Generous monthly AI Power'],
                cta: 'Get started',
                href: '/signup',
                highlight: false,
                enterprise: false,
              },
              {
                name: 'Pro',
                badge: 'Most popular',
                price: '$149',
                period: '/ month',
                desc: 'Full autonomy for security, finance, and ops teams.',
                features: ['Everything in Starter', 'Autonomous Playbooks', 'Webhook & event triggers', 'Discovery + full API Reference', 'Maximum monthly AI Power', 'Priority support'],
                cta: 'Go Pro',
                href: '/signup',
                highlight: true,
                enterprise: false,
              },
              {
                name: 'Enterprise',
                badge: null,
                price: 'Custom',
                period: 'annual',
                desc: 'Compliance, scale, and dedicated support.',
                features: ['Everything in Pro', 'Custom AI Power allowance', 'SSO / SAML', 'White-label branding', 'Dedicated SLA (99.9%)', 'Dedicated account manager'],
                cta: 'Talk to sales',
                href: '/contact?subject=enterprise',
                highlight: false,
                enterprise: true,
              },
            ].map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 space-y-5 flex flex-col ${
                  plan.highlight
                    ? 'border-[oklch(0.46_0.19_264)] bg-[oklch(0.12_0.022_264)]'
                    : plan.enterprise
                      ? 'border-amber-500/30 bg-[oklch(0.10_0.018_268)]'
                      : 'border-white/10 bg-[oklch(0.10_0.018_268)]'
                }`}
              >
                <div>
                  {plan.badge && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[oklch(0.46_0.19_264)]/20 text-[oklch(0.75_0.18_264)] text-[11px] font-semibold uppercase tracking-wide mb-3">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className={`text-lg font-bold ${plan.enterprise ? 'text-amber-300' : ''}`}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className="text-white/40 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-1.5">{plan.desc}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/75">
                      <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${plan.enterprise ? 'text-amber-400' : 'text-[oklch(0.65_0.18_264)]'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] ${
                    plan.highlight
                      ? 'bg-[oklch(0.46_0.19_264)] text-white hover:bg-[oklch(0.52_0.2_264)]'
                      : plan.enterprise
                        ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                        : 'bg-white/8 text-white hover:bg-white/12'
                  }`}
                >
                  {plan.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-white/25 mt-6">Flat-rate pricing — no per-run or per-task fees · Cancel anytime</p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-white/6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse at center, oklch(0.46 0.19 264) 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-2xl mx-auto text-center space-y-6 relative">
          <Orbit className="h-10 w-10 text-[oklch(0.7_0.2_264)] mx-auto opacity-60" />
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Ready to enter orbit?
          </h2>
          <p className="text-white/50 text-lg">
            Join teams already using OrbitAPI to run autonomous security response,
            financial reporting, and cross-system operations — on autopilot.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-base transition-all hover:scale-[1.02]"
          >
            Launch your free workspace <Rocket className="h-4 w-4" />
          </Link>
          <p className="text-xs text-white/25">No credit card required · Free forever plan · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
                  <Orbit className="h-3.5 w-3.5 text-[oklch(0.7_0.2_264)]" />
                </div>
                <span className="text-sm font-bold">OrbitAPI</span>
              </div>
              <p className="text-xs text-white/35 max-w-xs leading-relaxed">
                Mission control for your modern tech stack. Connect, automate, and command your APIs with AI.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div className="space-y-3">
                <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Product</p>
                <div className="space-y-2">
                  <a href="#features" className="block text-white/45 hover:text-white transition-colors">Features</a>
                  <a href="#how-it-works" className="block text-white/45 hover:text-white transition-colors">How it works</a>
                  <a href="#pricing" className="block text-white/45 hover:text-white transition-colors">Pricing</a>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Account</p>
                <div className="space-y-2">
                  <Link href="/login" className="block text-white/45 hover:text-white transition-colors">Sign in</Link>
                  <Link href="/signup" className="block text-white/45 hover:text-white transition-colors">Create account</Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Legal</p>
                <div className="space-y-2">
                  <Link href="/privacy" className="block text-white/45 hover:text-white transition-colors">Privacy policy</Link>
                  <Link href="/terms" className="block text-white/45 hover:text-white transition-colors">Terms of service</Link>
                  <Link href="/contact" className="block text-white/45 hover:text-white transition-colors">Contact us</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/25">© 2026 OrbitAPI. All rights reserved.</p>
            <p className="text-xs text-white/20">Built for the teams that keep the world running.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CosmicBackground } from '@/components/cosmic-background'
import { Reveal } from '@/components/reveal'
import { ExplainerDiagram } from './how-it-works/explainer-diagram'
import { HeroTerminal } from './hero-terminal'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'
import { getMarketingStats } from '@/lib/marketing-stats'
import {
  Orbit, Zap, Shield, ArrowRight, CheckCircle, Play, Bot,
  Plug, MessageSquare, Radio, Satellite, Globe2, Rocket,
  ShieldAlert, Package, Webhook, ScrollText, Clock, Gauge, ClipboardCheck,
} from 'lucide-react'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const stats = getMarketingStats()

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">

      {/* ── Living cosmos background — orbits as you scroll ──────────────── */}
      <CosmicBackground />

      {/* All content sits above the cosmos canvas (z-0) */}
      <div className="relative z-10">

      {/* ── Nav (shared with all marketing pages) ───────────────────────── */}
      <MarketingNav />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 sm:pt-40 sm:pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[oklch(0.46_0.19_264)]/40 bg-[oklch(0.46_0.19_264)]/10 text-[oklch(0.75_0.18_264)] text-xs font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.2_264)] animate-pulse inline-block shrink-0" />
            AI agents that operate your tools
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Every API in{' '}
            <span className="text-gradient-animated">
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
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98] animate-glow-pulse"
            >
              Begin your mission <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-medium text-base transition-colors"
            >
              <Play className="h-4 w-4" /> Watch the demo
            </Link>
          </div>

          {/* The zero-risk trial pitch — nobody else in the market can say this */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400/80" /> Try every connector in Simulated mode — no API keys, nothing real can break
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400/80" /> No credits, no model math — agents never stop mid-task
            </span>
          </div>
        </div>

        {/* Interactive hero terminal — visitor picks a mission, watches it play */}
        <HeroTerminal />

        {/* Connector logos strip */}
        <div className="max-w-3xl mx-auto mt-10 flex items-center justify-center gap-3 flex-wrap">
          {['crowdstrike', 'netsuite', 'servicenow', 'slack', 'teams', 'sendgrid', 'twilio', 'pagerduty'].map(slug => (
            <Link key={slug} href={`/integrations/${slug}`} className="h-8 w-8 rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity" title={slug}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${slug}.svg`} alt={slug} className="h-full w-full object-cover" />
            </Link>
          ))}
          <Link href="/integrations" className="text-xs text-white/30 hover:text-white/70 transition-colors ml-1">
            + {stats.total - 8} more →
          </Link>
        </div>

        {/* Real numbers, straight from the catalog the app runs on */}
        <div className="max-w-3xl mx-auto mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { n: String(stats.total), label: 'connectors in the catalog' },
            { n: `${stats.actions}+`, label: 'ready-to-run actions' },
            { n: String(stats.bundles), label: 'one-click bundles' },
            { n: '0', label: 'API keys needed to try it all' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5 text-center">
              <p className="text-2xl font-extrabold text-white">{s.n}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 border-t border-white/6 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Radio className="h-3 w-3" /> Mission briefing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">Ground control in three steps</h2>
            <p className="mt-3 text-white/50 text-base max-w-xl mx-auto">
              From zero to full API automation in minutes — no code required.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                step: '01',
                icon: Plug,
                title: 'Connect your APIs',
                desc: 'Browse 100+ pre-built connectors — security, ERP, communication, cloud. Start any of them in Simulated mode with realistic demo data, and add real credentials only when you’re ready.',
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
                  <div className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-7 h-full space-y-4 card-lift">
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

          {/* Live concept diagram — Connect → Skill → Playbook in motion */}
          <Reveal>
            <ExplainerDiagram embedded />
          </Reveal>
        </div>
      </section>

      {/* ── Features — architecture + differentiators, consolidated ─────── */}
      <section id="features" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Globe2 className="h-3 w-3" /> Systems overview
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">One system, working in harmony</h2>
            <p className="mt-3 text-white/50 text-base max-w-xl mx-auto">
              Whether you ask in chat or let it run on its own, every automation follows the same path —
              and every step is governed.
            </p>
          </Reveal>

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

          {/* What the pipeline can't show — the differentiators */}
          <div className="grid sm:grid-cols-3 gap-5 mt-6">
            {[
              {
                icon: Rocket,
                title: 'Simulated mode — try before you trust',
                desc: 'Every connector works as a realistic sandbox: create tickets, query invoices, flip lights — the data stays consistent, and nothing real can break. Convert to live credentials whenever you’re ready.',
                tag: 'Only on OrbitAPI',
              },
              {
                icon: Package,
                title: 'Bundles & Marketplace',
                desc: 'Install ready-made packs of connectors, skills, and playbooks in one click — Security SOC, Support Ops, and more — or publish your own.',
                tag: 'New',
              },
              {
                icon: Bot,
                title: 'Connect your AI',
                desc: 'Already live in Claude, ChatGPT, or Cursor? Plug OrbitAPI in as an MCP server and your assistant can operate your connected tools — reads run instantly, risky actions wait for your approval.',
                tag: 'New',
              },
            ].map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-6 space-y-3 hover:border-[oklch(0.46_0.19_264)]/40 hover:bg-[oklch(0.11_0.02_268)] transition-all card-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/15">
                      <Icon className="h-5 w-5 text-[oklch(0.7_0.2_264)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[oklch(0.7_0.2_264)]/15 text-[oklch(0.78_0.16_264)]">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs font-medium mb-4">
              <Rocket className="h-3 w-3" /> Launch plans
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">Pick your takeoff</h2>
            <p className="mt-3 text-white/50 text-base">
              Start free — try everything in Simulated mode before a single API key touches the system.
            </p>
          </Reveal>
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
                className={`rounded-2xl border p-6 space-y-5 flex flex-col card-lift ${
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
          <p className="text-center text-xs text-white/25 mt-6">
            Flat-rate pricing — no credits, no per-task fees, no model-tier math. Your automations never pause mid-task. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Before you ask</h2>
            <p className="mt-3 text-white/50 text-base">The questions everyone has before their first launch.</p>
          </Reveal>
          <div className="space-y-3">
            {[
              {
                q: 'Can I really try it without connecting anything real?',
                a: `Yes — that's the point of Simulated mode. Every available connector can spin up as a realistic sandbox with consistent demo data: query invoices, create tickets, contain endpoints. No API keys, no accounts on other services, and nothing real can break. When you're ready, swap in live credentials on the same connection.`,
              },
              {
                q: 'What stops the AI from doing something destructive?',
                a: 'Guardrails are built into the execution layer, not left to the AI\'s judgment. Write and destructive actions can be gated behind human approval — they queue up and run only after you approve. Every single action lands in a searchable audit trail, and simulated connections physically cannot touch real systems.',
              },
              {
                q: 'Which AI does it use?',
                a: 'OrbitAPI runs on frontier Claude models from Anthropic. You choose the AI Power level per task — Economy for routine checks, Maximum for complex missions — without managing API keys, tokens, or model names yourself.',
              },
              {
                q: 'How is this different from Zapier, Make, or n8n?',
                a: 'Those tools make you build the flowchart: every step, every branch, every field mapping. In OrbitAPI you state the goal in plain English and the AI plans the steps across your tools — and can re-plan when reality doesn\'t match the happy path. Plus: try-before-you-trust Simulated mode and human-approval gates that flowchart tools don\'t have.',
              },
              {
                q: 'Are my API keys safe?',
                a: 'Credentials are stored in a dedicated secrets vault, are only decrypted server-side at the moment an action executes, and are never included in AI prompts or shown back in the UI. You can revoke a connection at any time.',
              },
              {
                q: 'Do I need a credit card to start?',
                a: 'No. The Free plan needs no card and doesn\'t expire — it includes Simulated mode, up to 3 connected apps, and trial AI credits to run real missions. Paid plans are flat-rate with no per-task fees, and you can cancel anytime.',
              },
            ].map(item => (
              <details key={item.q} className="group rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] open:border-[oklch(0.46_0.19_264)]/40 transition-colors">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="text-white/30 group-open:rotate-45 transition-transform text-lg leading-none shrink-0">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm text-white/55 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-white/6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse at center, oklch(0.46 0.19 264) 0%, transparent 70%)' }} />
        </div>
        <Reveal className="max-w-2xl mx-auto text-center space-y-6 relative">
          <Orbit className="h-10 w-10 text-[oklch(0.7_0.2_264)] mx-auto opacity-60 animate-float" />
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Ready to enter orbit?
          </h2>
          <p className="text-white/50 text-lg">
            {stats.total} connectors, {stats.actions}+ actions, and an AI operator that plans the work for you —
            with every risky move gated behind your approval. Your first mission takes about 60 seconds.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-base transition-all hover:scale-[1.02] animate-glow-pulse"
          >
            Launch your free workspace <Rocket className="h-4 w-4" />
          </Link>
          <p className="text-xs text-white/25">No credit card · No API keys needed to try · Free forever plan · Cancel anytime</p>
        </Reveal>
      </section>

      {/* ── Footer (shared with all marketing pages) ────────────────────── */}
      <MarketingFooter />

      </div>{/* /content layer */}
    </div>
  )
}

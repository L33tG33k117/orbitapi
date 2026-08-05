import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, Server, ShieldCheck, WifiOff, Cpu, KeyRound, Network,
  PackageCheck, HardDrive, CheckCircle2,
} from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'

export const metadata: Metadata = {
  title: 'Self-hosted — OrbitAPI',
  description:
    'Run OrbitAPI on your own hardware. Air-gapped installs, your own AI model, and no data leaving your network — the same product, on your side of the firewall.',
}

// Every claim on this page has to match what the code actually does. The
// details come from docs/SELF_HOST.md and lib/license.ts; if the behaviour
// changes, this page changes with it.

const PILLARS = [
  {
    icon: WifiOff,
    title: 'No internet required',
    body:
      'Once installed, the whole stack runs with no outbound connection. No phone-home, no licence server to call, no telemetry. Air-gapped networks are the design target, not an afterthought.',
  },
  {
    icon: Cpu,
    title: 'Your model, your metal',
    body:
      'Point it at Ollama, LM Studio, or vLLM on your own network. Prompts and results never reach a third-party AI provider, because there is no third-party AI provider.',
  },
  {
    icon: HardDrive,
    title: 'Your data stays put',
    body:
      'Postgres runs in your own stack. Credentials are encrypted at rest with AES-256-GCM. Nothing is stored on our infrastructure, because we never see it.',
  },
]

const INCLUDED = [
  'Every connector in the catalogue, and the connector framework for building your own',
  'The Orbit Assistant, Skills, and Playbooks — the full product, not a cut-down build',
  'Simulated connectors that work with no AI configured at all, so you can explore before wiring anything up',
  'Per-connector network rules: each connector declares the hosts it may reach, and you can see and restrict them',
  'Single sign-on and role-based access, as on cloud',
]

export default function SelfHostedPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 mb-5">
            <Server className="h-3 w-3" /> Enterprise
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Run it on <span className="text-gradient-animated">your own hardware</span>
          </h1>
          <p className="mt-4 text-white/55 max-w-2xl mx-auto leading-relaxed">
            Some data can&apos;t leave the building. OrbitAPI ships as a self-contained package you
            install on your own server — with your own AI model, behind your own firewall, on a
            network that never has to reach the internet.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact?subject=selfhost"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[oklch(0.46_0.19_264)] text-white text-sm font-medium hover:bg-[oklch(0.52_0.2_264)] transition-colors"
            >
              Talk to us about self-hosting <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm font-medium hover:text-white hover:border-white/30 transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
          {PILLARS.map(p => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-6 space-y-3 card-lift"
              >
                <div className="h-9 w-9 rounded-lg bg-[oklch(0.46_0.19_264)]/15 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-[oklch(0.7_0.2_264)]" />
                </div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{p.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* What you get */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">The same product, on your side of the firewall</h2>
          <p className="text-white/45 text-sm mb-6 leading-relaxed">
            This isn&apos;t a stripped-down edition. It&apos;s the same codebase the hosted product
            runs on, packaged to run somewhere we can&apos;t reach.
          </p>
          <ul className="space-y-3">
            {INCLUDED.map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400/80 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What it takes to run */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-7 space-y-5">
          <h2 className="text-xl font-bold">What it takes to run</h2>
          <div className="grid sm:grid-cols-2 gap-5 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-white/80 flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-[oklch(0.7_0.2_264)]" /> A server
              </p>
              <p className="text-white/45 leading-relaxed">
                Linux, 4 CPU cores, 8 GB RAM, 40 GB disk is comfortable for a small team. Docker
                Engine 24+ with the Compose plugin. Windows works through WSL2, though Linux is the
                tested path.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-white/80 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-[oklch(0.7_0.2_264)]" /> An AI model — eventually
              </p>
              <p className="text-white/45 leading-relaxed">
                Ollama, LM Studio, or vLLM, on the same machine or elsewhere on your network.
                Optional at install time: simulated connectors work with no AI at all, so you can
                explore the product first and add a model when you&apos;re ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How licensing and updates work */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Licensing and updates, built for offline</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: KeyRound,
                title: 'Licences verify offline',
                body:
                  'Your key is cryptographically signed and checked on your own hardware. Nothing is transmitted to us to validate it — ever.',
              },
              {
                icon: PackageCheck,
                title: 'Updates on your schedule',
                body:
                  'Updates are downloaded, signature-verified, and applied when you choose. Nothing installs itself on a machine you own.',
              },
              {
                icon: ShieldCheck,
                title: 'Your data is never held hostage',
                body:
                  'If a licence lapses there is a 30-day grace period, and reading and exporting your data keeps working regardless.',
              },
            ].map(c => {
              const Icon = c.icon
              return (
                <div key={c.title} className="rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-5 space-y-2">
                  <Icon className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
                  <p className="font-semibold text-sm">{c.title}</p>
                  <p className="text-xs text-white/45 leading-relaxed">{c.body}</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-white/30 flex items-start gap-1.5 pt-1">
            <Network className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Self-hosting is available on the Enterprise plan. Tell us about your environment and
            we&apos;ll size it with you.
          </p>
        </div>
      </section>

      {/* Close */}
      <section className="pb-28 px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-[oklch(0.46_0.19_264)]/25 bg-[oklch(0.12_0.022_264)] p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Tell us where it needs to run</h2>
          <p className="text-white/50 text-sm max-w-xl mx-auto leading-relaxed">
            Air-gapped, on-premise, or just somewhere your compliance team is happy with — we&apos;ll
            work out what you need and get you installed.
          </p>
          <Link
            href="/contact?subject=selfhost"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[oklch(0.46_0.19_264)] text-white text-sm font-medium hover:bg-[oklch(0.52_0.2_264)] transition-colors"
          >
            Start the conversation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ShieldAlert, Headset, Banknote } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'
import { SOLUTIONS } from './solutions-data'

export const metadata: Metadata = {
  title: 'Solutions — OrbitAPI',
  description: 'How security, support, and finance teams put AI agents to work on their real tools — with approvals, audit trails, and a risk-free Simulated mode.',
}

const ICONS = { security: ShieldAlert, support: Headset, finance: Banknote } as const

export default function SolutionsIndexPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      <section className="pt-28 sm:pt-36 pb-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Built for the teams <span className="text-gradient-animated">on call</span>
          </h1>
          <p className="mt-4 text-white/55 max-w-2xl mx-auto leading-relaxed">
            The same mission control, tuned to three very different kinds of 3 AM problem.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {SOLUTIONS.map(s => {
            const Icon = ICONS[s.slug as keyof typeof ICONS] ?? ShieldAlert
            return (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="group rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-7 space-y-4 hover:border-[oklch(0.46_0.19_264)]/40 transition-all card-lift"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.46_0.19_264)]/15">
                  <Icon className="h-5 w-5 text-[oklch(0.7_0.2_264)]" />
                </div>
                <div>
                  <p className="text-xs text-white/35 mb-1">{s.nav}</p>
                  <h2 className="font-bold text-lg leading-snug">{s.headline}</h2>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">{s.sub}</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.72_0.18_264)] group-hover:gap-2.5 transition-all">
                  See how <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

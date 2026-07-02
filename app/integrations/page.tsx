import type { Metadata } from 'next'
import Link from 'next/link'
import { Rocket, ArrowRight } from 'lucide-react'
import { catalog, CATEGORY_ORDER } from '@/connectors/catalog'
import { getConnector } from '@/connectors'
import { getMarketingStats } from '@/lib/marketing-stats'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'
import { IntegrationsGrid, type GridEntry } from './integrations-grid'

export const metadata: Metadata = {
  title: 'Integrations — OrbitAPI',
  description:
    'Browse every OrbitAPI connector — security, ERP, communication, cloud, and more. Every integration works in Simulated mode before you hand over an API key.',
}

// Fully generated from connectors/catalog.ts — adding a connector to the
// catalog automatically adds it here (and its detail page) on the next deploy.
export default function IntegrationsPage() {
  const stats = getMarketingStats()

  const entries: GridEntry[] = catalog.map(c => ({
    slug: c.slug,
    name: c.name,
    category: c.category,
    description: c.description,
    logoUrl: c.logoUrl ?? null,
    available: c.available,
    actionCount: getConnector(c.slug)?.actions.length ?? 0,
  }))

  const categories = [
    ...CATEGORY_ORDER.filter(cat => entries.some(e => e.category === cat)),
    ...[...new Set(entries.map(e => e.category))].filter(cat => !CATEGORY_ORDER.includes(cat)),
  ]

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      <section className="pt-28 sm:pt-36 pb-10 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[oklch(0.46_0.19_264)]/40 bg-[oklch(0.46_0.19_264)]/10 text-[oklch(0.75_0.18_264)] text-xs font-medium mb-6">
            <Rocket className="h-3 w-3" /> {stats.total} connectors · {stats.actions}+ actions · all simulatable
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Every tool in <span className="text-gradient-animated">your orbit</span>
          </h1>
          <p className="mt-4 text-white/55 max-w-2xl mx-auto leading-relaxed">
            Security, ERP, communication, cloud, DevOps — each connector speaks plain English through the
            Orbit Assistant and runs in autonomous skills. Try any of them in Simulated mode with realistic
            demo data, no API keys required.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <IntegrationsGrid entries={entries} categories={categories} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-3xl font-bold">Don&apos;t see your tool?</h2>
          <p className="text-white/50">
            New connectors ship constantly — and every one launches with Simulated mode included.
            Tell us what you need and we&apos;ll prioritize it.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
            >
              Start free — no API keys needed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact?subject=connector-request"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-medium text-sm transition-colors"
            >
              Request a connector
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

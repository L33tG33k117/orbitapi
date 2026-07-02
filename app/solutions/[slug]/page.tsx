import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, X, Check, Package, FlaskConical } from 'lucide-react'
import { catalog } from '@/connectors/catalog'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'
import { SOLUTIONS } from '../solutions-data'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SOLUTIONS.map(s => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const s = SOLUTIONS.find(x => x.slug === slug)
  if (!s) return {}
  return {
    title: `${s.nav} — OrbitAPI`,
    description: `${s.headline}. ${s.sub}`,
  }
}

export default async function SolutionPage({ params }: Params) {
  const { slug } = await params
  const solution = SOLUTIONS.find(s => s.slug === slug)
  if (!solution) notFound()

  // Resolve against the live catalog so renames can't leave dead links.
  const tools = solution.connectorSlugs
    .map(cs => catalog.find(c => c.slug === cs))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-14 px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> All solutions
          </Link>
          <p className="text-xs uppercase tracking-widest text-[oklch(0.75_0.18_264)] font-semibold mb-3">{solution.nav}</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">{solution.headline}</h1>
          <p className="mt-5 text-lg text-white/55 max-w-2xl leading-relaxed">{solution.sub}</p>
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
            >
              Try it on simulated data <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-medium text-sm transition-colors"
            >
              Watch the demo
            </Link>
          </div>
        </div>
      </section>

      {/* Before / after */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-6 space-y-3">
            <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">Without OrbitAPI</p>
            {solution.pains.map(p => (
              <div key={p} className="flex items-start gap-2.5 text-sm text-white/55">
                <X className="h-4 w-4 text-red-400/70 shrink-0 mt-0.5" /> {p}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[oklch(0.46_0.19_264)]/30 bg-[oklch(0.12_0.022_264)] p-6 space-y-4">
            <p className="text-xs uppercase tracking-widest text-[oklch(0.75_0.18_264)] font-semibold">With OrbitAPI</p>
            {solution.missions.map(m => (
              <div key={m.prompt} className="space-y-1.5">
                <p className="text-sm text-white/85 font-mono">&ldquo;{m.prompt}&rdquo;</p>
                <div className="flex items-start gap-2 text-xs text-white/50">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> {m.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The tools it commands */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/30 mb-4">Works with your stack</h2>
          <div className="flex flex-wrap gap-2">
            {tools.map(t => (
              <Link
                key={t.slug}
                href={`/integrations/${t.slug}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-[oklch(0.10_0.018_268)] text-sm text-white/70 hover:text-white hover:border-[oklch(0.46_0.19_264)]/50 transition-colors"
              >
                {t.logoUrl ? (
                  <span className="h-5 w-5 rounded overflow-hidden inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.logoUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded bg-[oklch(0.46_0.19_264)]/20 text-[10px] font-bold text-[oklch(0.72_0.18_264)] inline-flex items-center justify-center">{t.name[0]}</span>
                )}
                {t.name}
              </Link>
            ))}
            <Link href="/integrations" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-white/15 text-sm text-white/40 hover:text-white/70 transition-colors">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bundle */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl border border-[oklch(0.46_0.19_264)]/25 bg-[oklch(0.09_0.018_268)] p-7 sm:p-9">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.46_0.19_264)]/15 shrink-0">
              <Package className="h-5 w-5 text-[oklch(0.7_0.2_264)]" />
            </div>
            <div className="space-y-2.5">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">One-click bundle</p>
              <h2 className="text-xl font-bold">{solution.bundleName}</h2>
              <p className="text-sm text-white/55 leading-relaxed max-w-2xl">{solution.bundlePitch}</p>
              <p className="inline-flex items-center gap-1.5 text-xs text-[oklch(0.75_0.18_264)]">
                <FlaskConical className="h-3.5 w-3.5" /> Installs fully simulated — nothing real required to evaluate it
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-3xl font-bold">See it on your kind of data</h2>
          <p className="text-white/50">
            Free plan, no credit card, no API keys — the {solution.bundleName} bundle runs on realistic simulated data the moment you sign up.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
          >
            Launch your free workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

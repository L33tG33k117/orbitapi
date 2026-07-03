import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, FlaskConical, Eye, PenLine, AlertTriangle, MessageSquare, Zap, ShieldCheck } from 'lucide-react'
import { catalog } from '@/connectors/catalog'
import { getConnector } from '@/connectors'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'

// One SEO landing page per catalog connector, statically generated from
// connectors/catalog.ts + the code manifests. New connectors get a page
// automatically on the next deploy.

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return catalog.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const entry = catalog.find(c => c.slug === slug)
  if (!entry) return {}
  return {
    title: `${entry.name} + AI automation — OrbitAPI`,
    description: `Connect ${entry.name} to OrbitAPI: command it in plain English, automate it with AI skills, and try it instantly in Simulated mode. ${entry.description}`,
  }
}

const RISK_META = {
  read: { icon: Eye, label: 'Read', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  write: { icon: PenLine, label: 'Write', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  destructive: { icon: AlertTriangle, label: 'Guarded', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
} as const

export default async function IntegrationPage({ params }: Params) {
  const { slug } = await params
  const entry = catalog.find(c => c.slug === slug)
  if (!entry) notFound()

  const manifest = getConnector(slug)
  const related = catalog.filter(c => c.category === entry.category && c.slug !== slug).slice(0, 6)

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      <section className="pt-28 sm:pt-36 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/integrations" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> All integrations
          </Link>

          <div className="flex items-start gap-5">
            {entry.logoUrl ? (
              <div className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.logoUrl} alt={entry.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-[oklch(0.46_0.19_264)]/15 border border-[oklch(0.46_0.19_264)]/25 flex items-center justify-center text-2xl font-bold text-[oklch(0.72_0.18_264)] shrink-0">
                {entry.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-white/35 mb-1">{entry.category}</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{entry.name}</h1>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {entry.available ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                      Available now
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[oklch(0.46_0.19_264)]/10 text-[oklch(0.75_0.18_264)] border border-[oklch(0.46_0.19_264)]/20 text-xs font-medium">
                      <FlaskConical className="h-3 w-3" /> Works in Simulated mode — no API key needed
                    </span>
                  </>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 text-xs font-medium">
                    Coming soon — request early access
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-6 text-white/55 leading-relaxed max-w-2xl">{entry.description}</p>
        </div>
      </section>

      {/* What you can do with it */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            {
              icon: MessageSquare,
              title: 'Command it in chat',
              desc: `Ask the Orbit Assistant about your ${entry.name} data in plain English — it plans the API calls and answers clearly, not with raw JSON.`,
            },
            {
              icon: Zap,
              title: 'Automate it with skills',
              desc: `Put ${entry.name} inside autonomous skills and playbooks that run on schedules, webhooks, or events — and chain it with your other tools.`,
            },
            {
              icon: ShieldCheck,
              title: 'Governed by default',
              desc: 'Risky actions queue for human approval, and every call lands in a searchable audit trail. Nothing happens without a record.',
            },
          ].map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-5 space-y-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/15">
                  <Icon className="h-4.5 w-4.5 text-[oklch(0.7_0.2_264)]" />
                </div>
                <h2 className="font-semibold text-sm">{f.title}</h2>
                <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Actions from the real manifest */}
      {manifest && manifest.actions.filter(a => a.slug !== 'explore_api').length > 0 && (
        <section className="pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            {manifest.actions.some(a => a.slug === 'explore_api') ? (
              <>
                <h2 className="text-xl font-bold mb-1.5">{manifest.actions.filter(a => a.slug !== 'explore_api').length} one-click shortcuts — plus the full API</h2>
                <p className="text-sm text-white/45 mb-6">
                  These cover the common tasks. Beyond them, OrbitAPI can reach {entry.name}&apos;s <span className="text-white/70">entire API</span> on
                  request — including all-time history and bulk data its own screens cap or hide. Every action works in Simulated
                  mode too, and guarded actions always require approval before touching anything real.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-1.5">{manifest.actions.length} built-in actions</h2>
                <p className="text-sm text-white/45 mb-6">
                  Every action works in Simulated mode too — guarded actions always require approval before touching anything real.
                </p>
              </>
            )}
            <div className="grid sm:grid-cols-2 gap-2.5">
              {manifest.actions.filter(a => a.slug !== 'explore_api').map(a => {
                const meta = RISK_META[a.risk]
                const Icon = meta.icon
                return (
                  <div key={a.slug} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-[oklch(0.10_0.018_268)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-[11px] text-white/35 font-mono truncate">{a.slug}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${meta.cls}`}>
                      <Icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-6 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-3xl font-bold">
            {entry.available ? <>Try {entry.name} in 60 seconds</> : <>Want {entry.name} on OrbitAPI?</>}
          </h2>
          <p className="text-white/50">
            {entry.available
              ? `Spin it up in Simulated mode with realistic demo data — no ${entry.name} account or API key required. Add real credentials whenever you're ready.`
              : 'Request early access and we’ll notify you the moment it ships — every new connector launches with Simulated mode included.'}
          </p>
          <Link
            href={entry.available ? '/signup' : `/contact?subject=connector-request-${entry.slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
          >
            {entry.available ? 'Start free' : 'Request early access'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/30 mb-4">More in {entry.category}</h2>
            <div className="flex flex-wrap gap-2">
              {related.map(r => (
                <Link
                  key={r.slug}
                  href={`/integrations/${r.slug}`}
                  className="px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-white/55 hover:text-white hover:border-[oklch(0.46_0.19_264)]/50 transition-colors"
                >
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <MarketingFooter />
    </div>
  )
}

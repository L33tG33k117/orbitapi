import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing/site-chrome'
import { CHANGELOG } from './changelog-data'

export const metadata: Metadata = {
  title: 'Changelog — OrbitAPI',
  description: 'What shipped, and when. OrbitAPI moves fast — new connectors, skills, and capabilities land constantly.',
}

const TAG_STYLES = {
  New: 'bg-[oklch(0.46_0.19_264)]/15 text-[oklch(0.78_0.16_264)] border-[oklch(0.46_0.19_264)]/25',
  Improved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Foundation: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
} as const

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white overflow-x-hidden">
      <MarketingNav />

      <section className="pt-28 sm:pt-36 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Shipping <span className="text-gradient-animated">at orbital velocity</span>
          </h1>
          <p className="mt-4 text-white/55 leading-relaxed">
            Every user-visible change, dated and in the open.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto relative">
          {/* Timeline spine */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/8 hidden sm:block" aria-hidden />
          <div className="space-y-10">
            {CHANGELOG.map(entry => (
              <article key={entry.date + entry.title} className="relative sm:pl-10">
                <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-[oklch(0.46_0.19_264)] bg-[oklch(0.07_0.02_268)] hidden sm:block" aria-hidden />
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <time dateTime={entry.date} className="text-xs text-white/35 font-mono">{formatDate(entry.date)}</time>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${TAG_STYLES[entry.tag]}`}>
                    {entry.tag}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-3">{entry.title}</h2>
                <ul className="space-y-2">
                  {entry.points.map(p => (
                    <li key={p} className="text-sm text-white/55 leading-relaxed flex gap-2.5">
                      <span className="text-[oklch(0.6_0.18_264)] shrink-0 mt-[3px]">◆</span> {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-3xl font-bold">Don&apos;t just read about it</h2>
          <p className="text-white/50">Everything above is live right now — and free to try on simulated data.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

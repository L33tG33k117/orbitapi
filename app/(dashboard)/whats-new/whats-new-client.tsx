'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Wrench, Layers } from 'lucide-react'
import type { ChangelogEntry } from '@/lib/release-notes/customer'

const TAG_STYLE: Record<ChangelogEntry['tag'], { icon: typeof Wrench; chip: string; blurb: string }> = {
  New:        { icon: Sparkles, chip: 'bg-primary/10 text-primary border-primary/30',            blurb: 'Something you can now do that you could not before' },
  Improved:   { icon: Wrench,   chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', blurb: 'Something that already existed, working better' },
  Foundation: { icon: Layers,   chip: 'bg-sky-500/10 text-sky-500 border-sky-500/30',            blurb: 'Groundwork you do not see directly' },
}

const FILTERS: (ChangelogEntry['tag'] | 'All')[] = ['All', 'New', 'Improved', 'Foundation']

// Remembers the newest release this browser has seen, so the top-bar button can
// show a dot when something has shipped since. Per-browser by design: it is a
// convenience, not a record, and it must never break the page if storage is
// unavailable (private windows, blocked site data).
const SEEN_KEY = 'orbit_whats_new_seen'

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function WhatsNewClient({ entries }: { entries: ChangelogEntry[] }) {
  const [filter, setFilter] = useState<ChangelogEntry['tag'] | 'All'>('All')

  useEffect(() => {
    try {
      if (entries[0]) window.localStorage.setItem(SEEN_KEY, entries[0].date)
    } catch { /* storage unavailable — the page still works */ }
  }, [entries])

  const visible = useMemo(
    () => (filter === 'All' ? entries : entries.filter(e => e.tag === filter)),
    [entries, filter],
  )

  // Group by month so a long history stays scannable.
  const months = useMemo(() => {
    const out: { month: string; items: ChangelogEntry[] }[] = []
    for (const e of visible) {
      const month = e.date.slice(0, 7)
      const last = out[out.length - 1]
      if (last && last.month === month) last.items.push(e)
      else out.push({ month, items: [e] })
    }
    return out
  }, [visible])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            title={f === 'All' ? 'Everything we have shipped' : TAG_STYLE[f].blurb}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {months.map(({ month, items }) => (
        <section key={month} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {monthLabel(items[0].date)}
          </h2>

          <div className="space-y-3">
            {items.map((e, i) => {
              const style = TAG_STYLE[e.tag]
              const Icon = style.icon
              return (
                <article key={`${e.date}-${i}`} className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 ${style.chip}`}>
                      <Icon className="h-3 w-3" />
                      {e.tag}
                    </span>
                    <time dateTime={e.date} className="text-[11px] text-muted-foreground">{dayLabel(e.date)}</time>
                  </div>

                  <h3 className="text-base font-semibold tracking-tight leading-snug">{e.title}</h3>

                  <ul className="space-y-2">
                    {e.points.map((p, j) => (
                      <li key={j} className="text-sm text-muted-foreground leading-relaxed flex gap-2.5">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-xl">
          Nothing tagged {filter} yet.
        </p>
      )}

      <p className="text-xs text-muted-foreground pt-2 border-t">
        Looking for something older, or want to link a colleague to a specific change? The same notes
        are public at <a href="/changelog" className="underline underline-offset-2 hover:text-foreground">orbitapi.com/changelog</a>.
      </p>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, FlaskConical } from 'lucide-react'

export interface GridEntry {
  slug: string
  name: string
  category: string
  description: string
  logoUrl: string | null
  available: boolean
  actionCount: number
}

export function IntegrationsGrid({ entries, categories }: { entries: GridEntry[]; categories: string[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e =>
      (!category || e.category === category) &&
      (!q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
    )
  }, [entries, query, category])

  const grouped = useMemo(() => {
    const map = new Map<string, GridEntry[]>()
    for (const cat of categories) {
      const items = filtered.filter(e => e.category === cat)
      if (items.length) map.set(cat, items)
    }
    return map
  }, [filtered, categories])

  return (
    <div className="space-y-10">
      {/* Search + category filter */}
      <div className="space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${entries.length} connectors…`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[oklch(0.46_0.19_264)]/60 transition-colors"
          />
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setCategory(null)}
            className={`px-3 py-1 rounded-full border text-xs transition-colors ${
              category === null ? 'border-[oklch(0.46_0.19_264)]/60 bg-[oklch(0.46_0.19_264)]/20 text-white' : 'border-white/10 text-white/45 hover:text-white/80'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(c => (c === cat ? null : cat))}
              className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                category === cat ? 'border-[oklch(0.46_0.19_264)]/60 bg-[oklch(0.46_0.19_264)]/20 text-white' : 'border-white/10 text-white/45 hover:text-white/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {grouped.size === 0 && (
        <p className="text-center text-white/40 text-sm py-16">
          No connectors match “{query}” — <Link href="/contact?subject=connector-request" className="text-[oklch(0.72_0.18_264)] hover:underline">request it</Link> and we&apos;ll build it.
        </p>
      )}

      {[...grouped.entries()].map(([cat, items]) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/30 mb-4">{cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(e => (
              <Link
                key={e.slug}
                href={`/integrations/${e.slug}`}
                className="group rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-5 space-y-2.5 hover:border-[oklch(0.46_0.19_264)]/40 hover:bg-[oklch(0.11_0.02_268)] transition-all card-lift"
              >
                <div className="flex items-center gap-3">
                  {e.logoUrl ? (
                    <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.logoUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-[oklch(0.46_0.19_264)]/15 flex items-center justify-center text-sm font-bold text-[oklch(0.72_0.18_264)] shrink-0">
                      {e.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{e.name}</p>
                    <p className="text-[11px] text-white/35">{e.category}</p>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{e.description}</p>
                <div className="flex items-center gap-2 text-[10px] pt-0.5">
                  {e.available ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {e.actionCount} actions
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[oklch(0.46_0.19_264)]/10 text-[oklch(0.75_0.18_264)] border border-[oklch(0.46_0.19_264)]/20 font-medium">
                        <FlaskConical className="h-2.5 w-2.5" /> Simulated mode
                      </span>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 font-medium">
                      Coming soon
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

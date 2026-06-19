'use client'

import { useState, useMemo } from 'react'
import { Search, Package, Store } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BundleCard, type BundleCardData } from './bundle-card'

const ALL = 'All'

function useFiltered(bundles: BundleCardData[], search: string, category: string) {
  return useMemo(() => {
    const q = search.toLowerCase()
    return bundles.filter(b => {
      const matchesCat = category === ALL || b.category === category
      const matchesQ = !q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) ||
        b.connectors.some(c => c.name.toLowerCase().includes(q))
      return matchesCat && matchesQ
    })
  }, [bundles, search, category])
}

export function BundlesClient({ builtin, marketplace }: { builtin: BundleCardData[]; marketplace: BundleCardData[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)

  const categories = useMemo(() => {
    const set = new Set([...builtin, ...marketplace].map(b => b.category))
    return [ALL, ...Array.from(set).sort()]
  }, [builtin, marketplace])

  const filteredBuiltin = useFiltered(builtin, search, category)
  const filteredMarket = useFiltered(marketplace, search, category)
  const total = filteredBuiltin.length + filteredMarket.length

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search bundles by name, what they do, or connector…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredBuiltin.length > 0 && (
        <section data-tour="bundles-list" className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> Vertical bundles</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredBuiltin.map(b => <BundleCard key={b.slug} {...b} />)}
          </div>
        </section>
      )}

      {filteredMarket.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Store className="h-4 w-4 text-primary" /> From the marketplace</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredMarket.map(b => <BundleCard key={b.slug} {...b} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">No bundles match your filters.</div>
      )}
    </div>
  )
}

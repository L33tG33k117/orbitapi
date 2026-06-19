'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Lock, FlaskConical, Search } from 'lucide-react'
import { ConnectDialog } from './connect-dialog'
import { SimulateDialog } from './simulate-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConnectorSummary } from '@/connectors/types'
import type { CatalogEntry } from '@/connectors/catalog'
import { CATEGORY_ORDER } from '@/connectors/catalog'

interface Props {
  catalog: CatalogEntry[]
  availableConnectors: Record<string, ConnectorSummary>
  canManage: boolean
  atConnectorLimit?: boolean
  disabledSlugs?: Set<string>
}

function CatalogCard({
  entry,
  summary,
  canManage,
  atLimit,
  disabled,
}: {
  entry: CatalogEntry
  summary: ConnectorSummary | undefined
  canManage: boolean
  atLimit?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [simOpen, setSimOpen] = useState(false)
  const available = entry.available && !!summary && !disabled
  // Only AVAILABLE real connectors are "locked" by the plan limit — never
  // coming-soon ones (showing "Upgrade to connect" on those is false advertising).
  const lockedByPlan = available && !entry.isSimulated && !!atLimit

  if (lockedByPlan) {
    return (
      <div className="group relative flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/10 p-4 opacity-60">
        {/* Logo + name row */}
        <div className="flex items-center gap-3">
          {entry.logoUrl ? (
            <Image src={entry.logoUrl} alt={entry.name} width={36} height={36} className="rounded-lg shrink-0 grayscale" unoptimized />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground select-none">
              {entry.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold leading-tight truncate">{entry.name}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{entry.category}</p>
          </div>
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">{entry.description}</p>
        <a
          href="/upgrade"
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <Lock className="h-3 w-3" /> Upgrade for more connectors
        </a>
      </div>
    )
  }

  return (
    <>
      <div className={`group relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 ${
        available
          ? 'border-border bg-card hover:border-primary/50 hover:shadow-md cursor-default'
          : 'border-border/50 bg-muted/20 opacity-70'
      }`}>
        {/* Logo + name row */}
        <div className="flex items-center gap-3">
          {entry.logoUrl ? (
            <Image
              src={entry.logoUrl}
              alt={entry.name}
              width={36}
              height={36}
              className="rounded-lg shrink-0"
              unoptimized
            />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground select-none">
              {entry.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold leading-tight truncate">{entry.name}</span>
              {entry.badgeNew && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide">
                  New
                </span>
              )}
              {entry.isSimulated && (
                <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 py-0 text-[10px] font-medium">
                  Demo
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{entry.category}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {entry.description}
        </p>

        {/* Action */}
        {disabled ? (
          <Button size="sm" variant="outline" className="w-full text-xs h-8 text-amber-500/70 border-amber-500/30" disabled>
            Temporarily unavailable
          </Button>
        ) : available ? (
          canManage ? (
            entry.isSimulated ? (
              /* Simulated-only connectors: single Connect button */
              <Button size="sm" variant="default" className="w-full text-xs h-8" onClick={() => setOpen(true)}>
                Connect
              </Button>
            ) : (
              /* Real connectors: Connect + Simulate */
              <div className="flex gap-1.5">
                <Button size="sm" variant="default" className="flex-1 min-w-0 text-xs h-8 justify-center whitespace-nowrap" onClick={() => setOpen(true)}>
                  Connect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 min-w-0 text-xs h-8 gap-1 justify-center whitespace-nowrap text-violet-400 border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
                  onClick={() => setSimOpen(true)}
                >
                  <FlaskConical className="h-3 w-3 shrink-0" />
                  Simulate
                </Button>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground text-center">Admin access required</p>
          )
        ) : (
          <Button size="sm" variant="outline" className="w-full text-xs h-8 text-muted-foreground" disabled>
            Coming soon
          </Button>
        )}
      </div>

      {summary && (
        <>
          <ConnectDialog connector={summary} open={open} onOpenChange={setOpen} />
          {!entry.isSimulated && (
            <SimulateDialog connector={summary} open={simOpen} onOpenChange={setSimOpen} />
          )}
        </>
      )}
    </>
  )
}

const ALL = 'All'

export function CatalogGrid({ catalog, availableConnectors, canManage, atConnectorLimit = false, disabledSlugs }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL)

  const categories = useMemo(() => {
    const inCatalog = new Set(catalog.map(e => e.category))
    return [ALL, ...CATEGORY_ORDER.filter(c => inCatalog.has(c))]
  }, [catalog])

  const newEntries = useMemo(() => catalog.filter(e => e.badgeNew).slice(0, 5), [catalog])

  const availableFirst = (a: CatalogEntry, b: CatalogEntry) =>
    a.available === b.available ? 0 : a.available ? -1 : 1

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return catalog
      .filter(e => {
        const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
        const matchesCategory = activeCategory === ALL || e.category === activeCategory
        return matchesSearch && matchesCategory
      })
      .sort(availableFirst)
  }, [catalog, search, activeCategory])

  const grouped = useMemo(() => {
    if (search || activeCategory !== ALL) return null
    const map = new Map<string, CatalogEntry[]>()
    for (const cat of CATEGORY_ORDER) {
      const entries = catalog.filter(e => e.category === cat).sort(availableFirst)
      if (entries.length) map.set(cat, entries)
    }
    return map
  }, [catalog, search, activeCategory])

  return (
    <div className="space-y-6">
      {/* Search — kept at the top of the catalog so it's the first thing you see */}
      <div data-tour="connector-search" className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search API connectors by name, category, or what they do…"
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveCategory(ALL) }}
          className="pl-9 h-11"
        />
      </div>

      {/* New connectors row */}
      {newEntries.length > 0 && !search && activeCategory === ALL && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">New API connectors</h2>
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Just added
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {newEntries.map(entry => (
              <CatalogCard
                key={entry.slug}
                entry={entry}
                summary={availableConnectors[entry.slug]}
                canManage={canManage}
                atLimit={atConnectorLimit}
                disabled={disabledSlugs?.has(entry.slug)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSearch('') }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {search || activeCategory !== ALL ? (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} API connector{filtered.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ` in ${activeCategory}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(entry => (
              <CatalogCard
                key={entry.slug}
                entry={entry}
                summary={availableConnectors[entry.slug]}
                canManage={canManage}
                atLimit={atConnectorLimit}
                disabled={disabledSlugs?.has(entry.slug)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No API connectors found for &ldquo;{search}&rdquo;
            </div>
          )}
        </>
      ) : grouped ? (
        Array.from(grouped.entries()).map(([category, entries]) => (
          <section key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{category}</h2>
              <span className="text-xs text-muted-foreground">
                {entries.filter(e => e.available).length}/{entries.length} available
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {entries.map(entry => (
                <CatalogCard
                  key={entry.slug}
                  entry={entry}
                  summary={availableConnectors[entry.slug]}
                  canManage={canManage}
                  atLimit={atConnectorLimit}
                  disabled={disabledSlugs?.has(entry.slug)}
                />
              ))}
            </div>
          </section>
        ))
      ) : null}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  ShieldAlert, Wrench, Sparkles, Gauge, Server, GitCommit, Database,
  ChevronDown, ChevronRight, Search, Megaphone, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import type { ReleaseEntry, ReleaseCounts } from '@/lib/release-notes'

const CATEGORY_STYLE: Record<string, { icon: typeof Wrench; chip: string }> = {
  security: { icon: ShieldAlert, chip: 'bg-red-500/10 text-red-500 border-red-500/30' },
  fix:      { icon: Wrench,      chip: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  feature:  { icon: Sparkles,    chip: 'bg-primary/10 text-primary border-primary/30' },
  perf:     { icon: Gauge,       chip: 'bg-sky-500/10 text-sky-500 border-sky-500/30' },
  infra:    { icon: Server,      chip: 'bg-violet-500/10 text-violet-500 border-violet-500/30' },
  other:    { icon: GitCommit,   chip: 'bg-muted text-muted-foreground border-border' },
}

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'security', label: 'Security' },
  { id: 'feature', label: 'New' },
  { id: 'fix', label: 'Fixes' },
  { id: 'perf', label: 'Performance' },
  { id: 'infra', label: 'Infrastructure' },
]

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface Props {
  entries: ReleaseEntry[]
  generatedAt: string
  generatedFrom: string | null
  deployedSha: string | null
  last30: ReleaseCounts
  last7: ReleaseCounts
  migrationCount: number
  newestCuratedDate: string | null
  unannouncedCount: number
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : 'bg-card'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  )
}

export function ReleasesClient({
  entries, generatedAt, generatedFrom, deployedSha,
  last30, last7, migrationCount, newestCuratedDate, unannouncedCount,
}: Props) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(entries[0]?.sha ?? null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      if (filter !== 'all' && e.category !== filter) return false
      if (!q) return true
      return (
        e.subject.toLowerCase().includes(q) ||
        e.short.toLowerCase().includes(q) ||
        e.areas.some(a => a.toLowerCase().includes(q)) ||
        e.paragraphs.some(p => p.toLowerCase().includes(q)) ||
        e.migrations.some(m => m.toLowerCase().includes(q))
      )
    })
  }, [entries, filter, query])

  // Group by calendar day so the feed reads as a timeline rather than a wall.
  const days = useMemo(() => {
    const out: { day: string; items: ReleaseEntry[] }[] = []
    for (const e of visible) {
      const day = e.date.slice(0, 10)
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(e)
      else out.push({ day, items: [e] })
    }
    return out
  }, [visible])

  const inSync = Boolean(deployedSha && generatedFrom && deployedSha.startsWith(generatedFrom.slice(0, 7)))

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Admin</p>
        <h1 className="text-2xl font-bold tracking-tight">Releases</h1>
        <p className="text-sm text-muted-foreground">
          Everything that landed on main, read from what we actually shipped. The customer-facing
          version is <a href="/whats-new" className="underline underline-offset-2 hover:text-foreground">What&apos;s new</a>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Shipped, last 7 days" value={last7.total} hint={`${last7.security} security, ${last7.fix} fixes`} />
        <Stat label="Shipped, last 30 days" value={last30.total} hint={`${last30.feature} new, ${last30.infra} infrastructure`} />
        <Stat label="Migrations shipped" value={migrationCount} hint="Each had to be applied to a database" />
        <Stat
          label="Not yet announced"
          value={unannouncedCount}
          hint={newestCuratedDate ? `Customer notes end ${newestCuratedDate}` : 'No customer notes yet'}
          tone={unannouncedCount > 0 ? 'warn' : 'ok'}
        />
      </div>

      {unannouncedCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <Megaphone className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {unannouncedCount} change{unannouncedCount === 1 ? '' : 's'} shipped since the last customer note.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              This list is generated, so it stays current on its own. The customer-facing notes are
              written by hand in <code className="px-1 rounded bg-muted text-[11px]">lib/release-notes/customer.ts</code>,
              on purpose: a commit subject is not release copy. Add an entry there when something is
              worth a customer&apos;s attention and this clears.
            </p>
          </div>
        </div>
      )}

      {/* Provenance. Without it nobody can tell whether this page describes
          what is actually running right now. */}
      <div className="rounded-xl border bg-card p-4 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          {inSync
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          <span className="font-medium">
            {inSync
              ? 'These notes match the build that is running.'
              : deployedSha
                ? 'These notes may be behind the running build.'
                : 'The running build is not identified in this environment.'}
          </span>
        </div>
        <p className="text-muted-foreground">
          Generated {new Date(generatedAt).toLocaleString()} from{' '}
          <code className="px-1 rounded bg-muted">{generatedFrom ? generatedFrom.slice(0, 7) : 'unknown'}</code>
          {deployedSha ? <>, running <code className="px-1 rounded bg-muted">{deployedSha.slice(0, 7)}</code></> : null}
          . Regenerate with <code className="px-1 rounded bg-muted">npm run notes:build</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search subject, area, migration, or hash"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border bg-background outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                filter === f.id ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} of {entries.length} change{entries.length === 1 ? '' : 's'}
      </p>

      <div className="space-y-6">
        {days.map(({ day, items }) => (
          <section key={day} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dayLabel(items[0].date)}
            </h2>
            <div className="space-y-2">
              {items.map(e => {
                const style = CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.other
                const Icon = style.icon
                const isOpen = open === e.sha
                return (
                  <div key={e.sha} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      onClick={() => setOpen(isOpen ? null : e.sha)}
                      className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.chip}`}>
                            {e.categoryLabel}
                          </span>
                          {e.migrations.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/10 text-orange-500 border-orange-500/30 inline-flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              {e.migrations.length} migration{e.migrations.length === 1 ? '' : 's'}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground font-mono">{e.short}</span>
                          <span className="text-[11px] text-muted-foreground">{timeLabel(e.date)} · {e.author}</span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{e.subject}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{e.files} file{e.files === 1 ? '' : 's'}</span>
                          <span className="text-emerald-500">+{e.added}</span>
                          <span className="text-red-500">-{e.removed}</span>
                          {e.areas.slice(0, 5).map(a => (
                            <span key={a} className="px-1.5 py-0.5 rounded bg-muted">{a}</span>
                          ))}
                          {e.areas.length > 5 && <span>+{e.areas.length - 5} more</span>}
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>

                    {isOpen && (
                      <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
                        {e.paragraphs.length > 0 ? (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why</h3>
                            {e.paragraphs.map((p, i) => (
                              <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No description was written for this change beyond its title.
                          </p>
                        )}

                        {e.migrations.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-orange-500">Database migrations</h3>
                            <p className="text-xs text-muted-foreground">
                              A self-hosted install has to apply these before this change works.
                            </p>
                            <ul className="space-y-1">
                              {e.migrations.map(m => (
                                <li key={m} className="text-xs font-mono px-2 py-1 rounded bg-orange-500/5 border border-orange-500/20">{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Areas touched</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {e.areas.map(a => (
                              <span key={a} className="px-2 py-0.5 rounded-full text-[11px] border bg-background">{a}</span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Largest changes
                          </h3>
                          <ul className="space-y-0.5">
                            {e.topPaths.map(p => (
                              <li key={p} className="text-[11px] font-mono text-muted-foreground truncate">{p}</li>
                            ))}
                          </ul>
                        </div>

                        <p className="text-[11px] text-muted-foreground font-mono pt-2 border-t">{e.sha}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-xl">
            Nothing matches that search.
          </p>
        )}
      </div>
    </div>
  )
}

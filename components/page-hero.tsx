// Slim deep-space header band for top-level pages — the compact sibling of the
// Overview mission-control hero. Always dark (both themes), like the sidebar.
// Use for section landing pages (Connectors, Skills, …); interior/detail pages
// should keep the lighter PageHeader.

interface PageHeroProps {
  /** Small uppercase kicker above the title — the nav section name ("Connect"). */
  eyebrow?: string
  title: string
  description?: string
  /** Big numbers shown on the right, e.g. [{ label: 'connected', value: 4 }]. */
  stats?: { label: string; value: string | number }[]
  /** Action buttons, rendered to the right of the stats. */
  children?: React.ReactNode
}

export function PageHero({ eyebrow, title, description, stats, children }: PageHeroProps) {
  return (
    <section className="deep-space-panel relative overflow-hidden rounded-3xl border border-white/10 px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex-1 min-w-[240px]">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{eyebrow}</p>
          )}
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-2 text-sm text-white/55 max-w-2xl">{description}</p>}
        </div>
        {(stats?.length || children) && (
          <div className="flex items-center gap-6 shrink-0">
            {stats?.map(s => (
              <div key={s.label} className="text-right">
                <p className="text-2xl font-bold tracking-tight text-white tabular-nums font-heading">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-white/45">{s.label}</p>
              </div>
            ))}
            {children && <div className="flex items-center gap-2">{children}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

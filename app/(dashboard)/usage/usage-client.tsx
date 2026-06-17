'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Zap, Plug, TrendingUp, Shield, AlertCircle, FileDown, CalendarRange } from 'lucide-react'

const RISK_CONFIG = {
  read:        { label: 'Read',        color: 'bg-blue-500',    text: 'text-blue-400' },
  write:       { label: 'Write',       color: 'bg-amber-500',   text: 'text-amber-400' },
  destructive: { label: 'Destructive', color: 'bg-red-500',     text: 'text-red-400' },
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`h-0.5 w-full ${accent}`} />
      <div className="p-5 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function thisMonthRange() {
  const now = new Date()
  return {
    from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateStr(now),
  }
}

function lastMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: toDateStr(first), to: toDateStr(last) }
}

export interface UsageData {
  totalCalls: number
  errorCalls: number
  skillTotal: number
  skillCompleted: number
  skillFailed: number
  totalConnections: number
  byRisk: Record<string, number>
  topConnectors: Array<{ slug: string; name: string; calls: number; errors: number }>
  dailyData: Array<{ label: string; reads: number; writes: number; destructive: number }>
  maxDaily: number
  dateRange: { from: string; to: string }
  workspaceName: string
}

export function UsageClient({ data }: { data: UsageData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [from, setFrom] = useState(data.dateRange.from)
  const [to, setTo] = useState(data.dateRange.to)
  const [showCustom, setShowCustom] = useState(false)

  function navigate(f: string, t: string) {
    startTransition(() => router.push(`/usage?from=${f}&to=${t}`))
  }

  function applyPreset(days: number) {
    const t = toDateStr(new Date())
    const f = toDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    setFrom(f); setTo(t); setShowCustom(false)
    navigate(f, t)
  }

  function applyThisMonth() {
    const r = thisMonthRange()
    setFrom(r.from); setTo(r.to); setShowCustom(false)
    navigate(r.from, r.to)
  }

  function applyLastMonth() {
    const r = lastMonthRange()
    setFrom(r.from); setTo(r.to); setShowCustom(false)
    navigate(r.from, r.to)
  }

  function applyCustom() {
    if (!from || !to) return
    navigate(from, to)
    setShowCustom(false)
  }

  function exportPDF() {
    window.print()
  }

  const {
    totalCalls, errorCalls, skillTotal, skillCompleted, skillFailed,
    totalConnections, byRisk, topConnectors, dailyData, maxDaily,
    dateRange, workspaceName,
  } = data

  const fromLabel = new Date(dateRange.from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const toLabel   = new Date(dateRange.to   + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const rangeLabel = `${fromLabel} – ${toLabel}`

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @page { size: letter portrait; margin: 0.65in; }
          aside, nav, .no-print { display: none !important; }
          main { overflow: visible !important; }
          .print-header { display: block !important; }
          .print-break-inside { break-inside: avoid; }
          .print-break-before { break-before: page; }
          body { font-size: 11pt; }
          .rounded-xl { border-radius: 8px !important; }
        }
      `}</style>

      <div className="p-8 space-y-8 max-w-4xl print:p-0 print:max-w-none print:space-y-6">

        {/* Print-only report header */}
        <div className="print-header hidden print:block mb-6 pb-4 border-b-2 border-foreground/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-black tracking-tight" style={{ letterSpacing: '-0.04em' }}>
                ORBIT<span style={{ opacity: 0.5 }}>API</span>
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{workspaceName}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">API Usage Report</p>
              <p>{rangeLabel}</p>
              <p>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              <p>{totalConnections} connected API{totalConnections !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold">Usage</h1>
            <p className="text-muted-foreground mt-1 text-sm">{rangeLabel} · {totalConnections} connected APIs</p>
          </div>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
        </div>

        {/* Date range controls */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={applyThisMonth}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors"
          >
            This month
          </button>
          <button
            onClick={applyLastMonth}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors"
          >
            Last month
          </button>
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
          >
            Custom range
          </button>

          {showCustom && (
            <div className="flex items-center gap-2 mt-2 w-full">
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => setFrom(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={to}
                min={from}
                max={toDateStr(new Date())}
                onChange={e => setTo(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <button
                onClick={applyCustom}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print-break-inside">
          <StatCard icon={Activity} label="API Calls" value={totalCalls.toLocaleString()} sub="in range" accent="bg-blue-500" />
          <StatCard icon={Zap} label="Skill Runs" value={skillTotal} sub={`${skillCompleted} completed`} accent="bg-emerald-500" />
          <StatCard icon={AlertCircle} label="Errors" value={errorCalls} sub={totalCalls > 0 ? `${Math.round(errorCalls / totalCalls * 100)}% error rate` : '0% error rate'} accent="bg-red-500" />
          <StatCard icon={TrendingUp} label="Success Rate" value={totalCalls > 0 ? `${Math.round((1 - errorCalls / totalCalls) * 100)}%` : '—'} sub="all API calls" accent="bg-primary" />
        </div>

        {/* Risk breakdown */}
        <section className="space-y-3 print-break-inside">
          <h2 className="text-sm font-semibold">Call type breakdown</h2>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            {(['read', 'write', 'destructive'] as const).map(risk => {
              const count = byRisk[risk] ?? 0
              const pct = totalCalls > 0 ? Math.round(count / totalCalls * 100) : 0
              const cfg = RISK_CONFIG[risk]
              return (
                <div key={risk} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Shield className={`h-3 w-3 ${cfg.text}`} />
                      <span className="font-medium">{cfg.label}</span>
                    </div>
                    <span className="text-muted-foreground">{count.toLocaleString()} <span className="text-muted-foreground/50">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.color}`} style={{ width: `${pct}%`, opacity: 0.75 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Daily activity chart */}
        <section className="space-y-3 print-break-inside">
          <h2 className="text-sm font-semibold">Daily activity</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            {dailyData.length > 0 ? (
              <>
                <div className="flex items-end gap-2" style={{ height: '96px' }}>
                  {dailyData.map(({ label, reads, writes, destructive }) => {
                    const total = reads + writes + destructive
                    const pct = maxDaily > 0 ? total / maxDaily : 0
                    return (
                      <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                          {total > 0 ? (
                            <div className="w-full rounded overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(pct * 80, 4)}px` }}>
                              {destructive > 0 && <div className="w-full bg-red-500/60" style={{ height: `${destructive / total * 100}%` }} />}
                              {writes > 0 && <div className="w-full bg-amber-500/60" style={{ height: `${writes / total * 100}%` }} />}
                              {reads > 0 && <div className="w-full bg-blue-500/50" style={{ height: `${reads / total * 100}%` }} />}
                            </div>
                          ) : (
                            <div className="w-full bg-muted/20 rounded" style={{ height: '4px' }} />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 text-center leading-tight">{label.split(',')[0]}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="h-2 w-2 rounded-sm bg-blue-500/60" />Read</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="h-2 w-2 rounded-sm bg-amber-500/60" />Write</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="h-2 w-2 rounded-sm bg-red-500/60" />Destructive</div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No activity in this date range.</p>
            )}
          </div>
        </section>

        {/* Skill run outcomes */}
        {skillTotal > 0 && (
          <section className="space-y-3 print-break-inside">
            <h2 className="text-sm font-semibold">Skill run outcomes</h2>
            <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-400">{skillCompleted}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{skillFailed}</p>
                <p className="text-xs text-muted-foreground mt-1">Failed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{skillTotal - skillCompleted - skillFailed}</p>
                <p className="text-xs text-muted-foreground mt-1">Running / other</p>
              </div>
            </div>
          </section>
        )}

        {/* Top connectors */}
        {topConnectors.length > 0 && (
          <section className="space-y-3 print-break-inside">
            <h2 className="text-sm font-semibold">Top connectors by usage</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {topConnectors.map(({ slug, name, calls, errors }, i) => {
                const pct = calls / (topConnectors[0].calls || 1) * 100
                const errPct = calls > 0 ? Math.round(errors / calls * 100) : 0
                return (
                  <div key={slug} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-xs text-muted-foreground/40 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {calls.toLocaleString()} calls
                          {errors > 0 && <span className="text-red-400 ml-2">{errPct}% errors</span>}
                        </p>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {totalCalls === 0 && (
          <div className="py-16 text-center border border-dashed rounded-xl space-y-2">
            <Plug className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No API calls in this period</p>
            <p className="text-xs text-muted-foreground/60">Try a different date range, or connect an API and run a skill.</p>
          </div>
        )}

        {/* Print-only executive summary box */}
        <div className="print-header hidden print:block mt-6 p-4 border rounded-lg bg-muted/20 print-break-inside">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Executive Summary</p>
          <p className="text-sm">
            During the period <strong>{rangeLabel}</strong>, {workspaceName} made{' '}
            <strong>{totalCalls.toLocaleString()} API calls</strong> across {totalConnections} connected integration{totalConnections !== 1 ? 's' : ''}.
            {skillTotal > 0 && ` ${skillTotal} skill run${skillTotal !== 1 ? 's' : ''} were executed, with a ${Math.round(skillCompleted / skillTotal * 100)}% completion rate.`}
            {totalCalls > 0 && ` Overall API success rate was ${Math.round((1 - errorCalls / totalCalls) * 100)}%.`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-3">
            This report was automatically generated by OrbitAPI · Confidential
          </p>
        </div>
      </div>
    </>
  )
}

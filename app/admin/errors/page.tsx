'use client'

import { useEffect, useState } from 'react'
import { Bug, ChevronDown, ChevronUp, Check, RotateCcw, Monitor, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorEvent {
  id: string
  source: 'client' | 'server'
  message: string
  stack: string | null
  url: string | null
  context: string | null
  user_agent: string | null
  occurrences: number
  resolved: boolean
  first_seen_at: string
  last_seen_at: string
  profile: { email: string; full_name: string | null } | null
  workspace: { name: string } | null
}

function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function AdminErrorsPage() {
  const [events, setEvents] = useState<ErrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/errors?filter=${filter}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setUnavailable(Boolean(d.unavailable)) })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false))
  }, [filter])

  async function toggleResolved(ev: ErrorEvent) {
    setSaving(ev.id)
    const res = await fetch('/api/admin/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ev.id, resolved: !ev.resolved }),
    })
    if (res.ok) {
      // Drop it from a filtered list rather than leaving a row that no longer
      // matches the filter sitting there looking stale.
      setEvents(prev =>
        filter === 'all'
          ? prev.map(e => (e.id === ev.id ? { ...e, resolved: !e.resolved } : e))
          : prev.filter(e => e.id !== ev.id),
      )
    }
    setSaving(null)
  }

  return (
    <div className="p-4 sm:p-8 space-y-5 max-w-5xl">
      <div className="flex items-center gap-2.5">
        <Bug className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Errors</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Crashes and failures from real users, grouped so one repeating bug is one row.
        Marking something resolved hides it — if it happens again it comes back automatically.
      </p>

      {unavailable ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-1">
          <p className="font-medium text-amber-500">Error log not set up yet</p>
          <p className="text-muted-foreground">
            Migration <code className="text-xs">052_error_events.sql</code> hasn&apos;t been applied to
            this database. Until it is, errors still go to the Vercel logs — nothing is lost, they just
            aren&apos;t shown here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {(['open', 'resolved', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
                  filter === f
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>
          ) : events.length === 0 ? (
            <div className="py-16 text-center border border-dashed rounded-2xl space-y-2">
              <Check className="h-8 w-8 text-emerald-500/60 mx-auto" />
              <p className="font-medium">
                {filter === 'open' ? 'No open errors' : 'Nothing here'}
              </p>
              <p className="text-sm text-muted-foreground">
                {filter === 'open' ? 'Nothing has broken for anyone recently.' : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(ev => {
                const open = expanded === ev.id
                const Icon = ev.source === 'client' ? Monitor : Server
                return (
                  <div key={ev.id} className="border rounded-xl bg-card overflow-hidden">
                    <button
                      onClick={() => setExpanded(open ? null : ev.id)}
                      className="w-full text-left p-3 flex items-start gap-3"
                    >
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium break-words">{ev.message}</p>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                          {ev.occurrences > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                              ×{ev.occurrences}
                            </span>
                          )}
                          {ev.context && <span className="font-mono">{ev.context}</span>}
                          {ev.url && <span className="truncate max-w-[200px]">{ev.url}</span>}
                          {ev.profile && <span>{ev.profile.full_name ?? ev.profile.email}</span>}
                          {ev.workspace && <span>· {ev.workspace.name}</span>}
                          <span>· last {ago(ev.last_seen_at)}</span>
                        </div>
                      </div>
                      {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>

                    {open && (
                      <div className="border-t px-3 py-3 space-y-3">
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          {[
                            ['Source', ev.source],
                            ['First seen', ago(ev.first_seen_at)],
                            ['Last seen', ago(ev.last_seen_at)],
                            ['Times', String(ev.occurrences)],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <dt className="text-muted-foreground">{k}</dt>
                              <dd className="font-medium capitalize">{v}</dd>
                            </div>
                          ))}
                        </dl>

                        {ev.user_agent && (
                          <p className="text-[11px] text-muted-foreground break-all">{ev.user_agent}</p>
                        )}

                        {ev.stack && (
                          <pre className="text-[11px] leading-relaxed bg-muted/50 rounded-lg p-2.5 overflow-x-auto max-h-64">
                            {ev.stack}
                          </pre>
                        )}

                        <Button
                          size="sm"
                          variant={ev.resolved ? 'outline' : 'default'}
                          disabled={saving === ev.id}
                          onClick={() => toggleResolved(ev)}
                        >
                          {ev.resolved
                            ? <><RotateCcw className="h-3.5 w-3.5" /> Reopen</>
                            : <><Check className="h-3.5 w-3.5" /> Mark resolved</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

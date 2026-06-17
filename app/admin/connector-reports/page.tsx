'use client'

import { useEffect, useState } from 'react'
import { Flag, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Report {
  id: string
  connector_slug: string
  connector_name: string
  what_wrong: string
  error_message: string | null
  status: 'open' | 'investigating' | 'resolved'
  admin_note: string | null
  created_at: string
  profile: { email: string; full_name: string | null } | null
  workspace: { name: string } | null
}

const STATUS_STYLES = {
  open:          'bg-red-500/15 text-red-400',
  investigating: 'bg-amber-500/15 text-amber-400',
  resolved:      'bg-emerald-500/15 text-emerald-400',
}

const NEXT_STATUS: Record<Report['status'], Report['status']> = {
  open: 'investigating',
  investigating: 'resolved',
  resolved: 'open',
}

export default function ConnectorReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Report['status']>('open')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/connector-reports')
      .then(r => r.json())
      .then((data: Report[]) => { setReports(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  async function updateReport(id: string, status: Report['status']) {
    setSaving(id)
    const res = await fetch(`/api/admin/connector-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: notes[id] ?? undefined }),
    })
    if (res.ok) {
      const updated = await res.json()
      setReports(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    }
    setSaving(null)
  }

  async function saveNote(id: string) {
    setSaving(id)
    const res = await fetch(`/api/admin/connector-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_note: notes[id] }),
    })
    if (res.ok) {
      const updated = await res.json()
      setReports(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    }
    setSaving(null)
  }

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter)
  const counts = { open: 0, investigating: 0, resolved: 0 }
  for (const r of reports) counts[r.status]++

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
          <Flag className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Connector Reports</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            User-submitted issues with connectors. Investigate, leave notes, and mark resolved.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['open', 'investigating', 'resolved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize
              ${filter === f ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {f}
            {f !== 'all' && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLES[f]}`}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center border border-dashed rounded-xl text-muted-foreground">
          No {filter === 'all' ? '' : filter} reports
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(report => {
          const isOpen = expanded === report.id
          return (
            <div key={report.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{report.connector_name}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{report.connector_slug}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[report.status]}`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {report.profile?.email ?? '—'} · {report.workspace?.name ?? '—'} · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{report.what_wrong}</p>
                  {report.error_message && (
                    <pre className="text-[11px] font-mono text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                      {report.error_message}
                    </pre>
                  )}
                  {report.admin_note && !isOpen && (
                    <p className="text-xs text-primary/70 italic">Note: {report.admin_note}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => updateReport(report.id, NEXT_STATUS[report.status])}
                    disabled={saving === report.id}
                  >
                    {report.status === 'open' ? 'Investigate' : report.status === 'investigating' ? 'Resolve' : 'Reopen'}
                  </Button>
                  <button
                    onClick={() => setExpanded(isOpen ? null : report.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin note</p>
                  <textarea
                    rows={2}
                    value={notes[report.id] ?? report.admin_note ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                    placeholder="Internal note about this report…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button size="sm" variant="outline" onClick={() => saveNote(report.id)} disabled={saving === report.id}>
                    Save note
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {reports.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            If a connector has multiple open reports, consider disabling it from the <strong>Connector Requests</strong> page until the issue is resolved.
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { MessageSquarePlus, Check, CheckCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Status = 'new' | 'acknowledged' | 'actioned'

interface FeedbackRow {
  id: string
  message: string
  page_url: string | null
  status: Status
  created_at: string
  user: { email: string; full_name: string | null } | null
  workspace: { name: string } | null
}

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-amber-500/15 text-amber-400',
  acknowledged: 'bg-blue-500/15 text-blue-400',
  actioned: 'bg-emerald-500/15 text-emerald-400',
}
const STATUS_LABEL: Record<Status, string> = { new: 'New', acknowledged: 'Acknowledged', actioned: 'Actioned' }

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'actioned', label: 'Actioned' },
]

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function setStatus(id: string, status: Status) {
    setBusy(id)
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setBusy(null)
    if (!res.ok) { toast.error('Could not update'); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`)
  }

  async function remove(id: string) {
    if (!confirm('Delete this feedback permanently?')) return
    setBusy(id)
    const res = await fetch(`/api/admin/feedback/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { toast.error('Could not delete'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    toast.success('Feedback deleted')
  }

  const counts = {
    all: rows.length,
    new: rows.filter(r => r.status === 'new').length,
    acknowledged: rows.filter(r => r.status === 'acknowledged').length,
    actioned: rows.filter(r => r.status === 'actioned').length,
  }
  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <MessageSquarePlus className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {counts.new} new · {rows.length} total
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
          {filter === 'all' ? 'No feedback yet.' : `No ${filter} feedback.`}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap flex-1">{r.message}</p>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_STYLES[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{r.user?.full_name || r.user?.email || 'Unknown'}</span>
                {r.workspace?.name && <span>· {r.workspace.name}</span>}
                {r.page_url && <span>· <code className="text-[11px]">{r.page_url}</code></span>}
                <span>· {new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {r.status === 'new' && (
                  <button
                    onClick={() => setStatus(r.id, 'acknowledged')}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Acknowledge
                  </button>
                )}
                {r.status !== 'actioned' && (
                  <button
                    onClick={() => setStatus(r.id, 'actioned')}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark actioned
                  </button>
                )}
                {r.status !== 'new' && (
                  <button
                    onClick={() => setStatus(r.id, 'new')}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
                <button
                  onClick={() => remove(r.id)}
                  disabled={busy === r.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

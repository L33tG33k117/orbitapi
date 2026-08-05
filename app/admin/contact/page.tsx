'use client'

import { useEffect, useState } from 'react'
import { Inbox, Mail, Check, Archive, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type Status = 'new' | 'replied' | 'closed'

interface ContactRow {
  id: string
  name: string
  email: string
  message: string
  subject: string
  status: Status
  notified: boolean
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-amber-500/15 text-amber-400',
  replied: 'bg-emerald-500/15 text-emerald-400',
  closed: 'bg-muted text-muted-foreground',
}
const STATUS_LABEL: Record<Status, string> = { new: 'New', replied: 'Replied', closed: 'Closed' }

// Sales enquiries are the ones worth money — surface them, don't bury them.
const SUBJECT_LABEL: Record<string, string> = {
  general: 'General',
  enterprise: 'Enterprise',
  selfhost: 'Self-hosted',
  support: 'Support',
  partnership: 'Partnership',
}
const HOT = new Set(['enterprise', 'selfhost'])

const FILTERS: { key: Status | 'all' | 'sales'; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'new', label: 'New' },
  { key: 'replied', label: 'Replied' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

export default function AdminContactPage() {
  const [rows, setRows] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all' | 'sales'>('sales')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/contact')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function setStatus(id: string, status: Status) {
    setBusy(id)
    const res = await fetch(`/api/admin/contact/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setBusy(null)
    if (!res.ok) { toast.error('Could not update'); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`)
  }

  async function remove(id: string) {
    if (!confirm('Delete this message permanently?')) return
    setBusy(id)
    const res = await fetch(`/api/admin/contact/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { toast.error('Could not delete'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    toast.success('Message deleted')
  }

  const counts = {
    sales: rows.filter(r => HOT.has(r.subject)).length,
    new: rows.filter(r => r.status === 'new').length,
    replied: rows.filter(r => r.status === 'replied').length,
    closed: rows.filter(r => r.status === 'closed').length,
    all: rows.length,
  }
  const visible =
    filter === 'all' ? rows
      : filter === 'sales' ? rows.filter(r => HOT.has(r.subject))
        : rows.filter(r => r.status === filter)

  // Every row unnotified means email isn't configured — worth saying plainly,
  // because it's the difference between "check this page daily" and "you'll
  // get a ping".
  const anyNotified = rows.some(r => r.notified)

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <Inbox className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Contact messages</h1>
          <p className="text-sm text-muted-foreground">
            {counts.new} new · {counts.sales} sales · {rows.length} total
          </p>
        </div>
      </div>

      {rows.length > 0 && !anyNotified && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200/90">
            No email notifications have gone out. Messages are being saved safely, but nobody is
            being told about them — so this page has to be checked by hand. Set{' '}
            <code className="text-xs">RESEND_API_KEY</code> and{' '}
            <code className="text-xs">CONTACT_NOTIFY_EMAIL</code> to get pinged instead.
          </p>
        </div>
      )}

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
          {filter === 'sales' ? 'No sales enquiries yet.' : `No ${filter === 'all' ? '' : filter} messages.`}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                    HOT.has(r.subject) ? 'bg-amber-500/20 text-amber-300' : 'bg-muted text-muted-foreground'
                  }`}>
                    {SUBJECT_LABEL[r.subject] ?? r.subject}
                  </span>
                  <span className="font-medium text-sm">{r.name}</span>
                  <a href={`mailto:${r.email}`} className="text-xs text-primary hover:underline">{r.email}</a>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_STYLES[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              <p className="text-sm whitespace-pre-wrap">{r.message}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{new Date(r.created_at).toLocaleString()}</span>
                {!r.notified && <span>· not emailed</span>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`mailto:${r.email}?subject=Re: your OrbitAPI enquiry`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" /> Reply
                </a>
                {r.status !== 'replied' && (
                  <button
                    onClick={() => setStatus(r.id, 'replied')}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark replied
                  </button>
                )}
                {r.status !== 'closed' && (
                  <button
                    onClick={() => setStatus(r.id, 'closed')}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Archive className="h-3.5 w-3.5" /> Close
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

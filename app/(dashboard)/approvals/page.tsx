'use client'

import { useEffect, useState } from 'react'
import { Check, X, Clock, AlertTriangle, ShieldAlert, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionIntro } from '@/components/section-intro'

interface PendingAction {
  id: string
  action_slug: string
  params: Record<string, unknown>
  summary: string | null
  status: 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executed' | 'failed'
  expires_at: string | null
  created_at: string
  user_id: string
  connection: { id: string; label: string; connector: { slug: string; name: string } } | null
  requester: { email: string; full_name: string | null } | null
}

const RISK_SLUGS: Record<string, 'read' | 'write' | 'destructive'> = {}

const STATUS_LABELS: Record<PendingAction['status'], string> = {
  pending: 'Awaiting approval',
  confirmed: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  executed: 'Executed',
  failed: 'Failed',
}

const STATUS_COLORS: Record<PendingAction['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
  expired: 'bg-muted text-muted-foreground',
  executed: 'bg-blue-500/15 text-blue-400',
  failed: 'bg-red-500/15 text-red-400',
}

function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'Expiring now'
  return `Expires in ${m}m`
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Preview { risk: string; reversible: boolean; impact: string; loading?: boolean }

export default function ApprovalsPage() {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, Preview>>({})
  const [rollback, setRollback] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/approvals')
      .then(r => r.json())
      .then(data => { setActions(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  // #9 — fetch an impact preview when an action is expanded.
  async function loadPreview(a: PendingAction) {
    if (!a.connection || previews[a.id]) return
    setPreviews(p => ({ ...p, [a.id]: { risk: '', reversible: true, impact: '', loading: true } }))
    const res = await fetch('/api/actions/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: a.connection.id, actionSlug: a.action_slug, params: a.params }),
    })
    const data = await res.json()
    if (res.ok) setPreviews(p => ({ ...p, [a.id]: { ...data, loading: false } }))
    else setPreviews(p => { const c = { ...p }; delete c[a.id]; return c })
  }

  function toggleExpand(a: PendingAction) {
    const next = expanded === a.id ? null : a.id
    setExpanded(next)
    if (next) loadPreview(a)
  }

  async function approve(id: string) {
    setActing(id)
    setError(null)
    const res = await fetch(`/api/approvals/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollback_reasoning: rollback[id] || undefined }),
    })
    const body = await res.json()
    if (res.ok) {
      setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'executed' } : a))
      setExpanded(null)
    } else {
      setError(body.error ?? 'Approval failed')
    }
    setActing(null)
  }

  async function reject(id: string) {
    setActing(id)
    const res = await fetch(`/api/approvals/${id}/reject`, { method: 'POST' })
    if (res.ok) {
      setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a))
      setExpanded(null)
    }
    setActing(null)
  }

  const filtered = filter === 'pending'
    ? actions.filter(a => a.status === 'pending')
    : actions

  const pendingCount = actions.filter(a => a.status === 'pending').length

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-1">
          When a skill wants to make a change, it queues the action here for your sign-off before it runs.
        </p>
      </div>

      <SectionIntro id="approvals" />

      {/* Risk-level legend — explains what read / write / destructive mean */}
      <div data-tour="approvals-legend" className="rounded-xl border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Action types</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground shrink-0">read</span>
            <p className="text-muted-foreground">Only looks things up — lists, searches, fetches. Never changes anything, so it runs without approval.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-400 shrink-0">write</span>
            <p className="text-muted-foreground">Creates or updates something — sends a message, opens a ticket, changes a record. Needs your approval.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-400 shrink-0">destructive</span>
            <p className="text-muted-foreground">Hard to undo — deletes data, isolates a host, cancels an order. Needs approval and a rollback plan.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div data-tour="approvals-filter" className="flex gap-1 border-b border-border">
        {(['pending', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize
              ${filter === f
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {f === 'pending' ? `Pending ${pendingCount > 0 ? `(${pendingCount})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center border border-dashed rounded-xl space-y-2">
            <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {filter === 'pending' ? 'No pending approvals' : 'No action history yet'}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Supervised skills queue write actions here for your review before they execute.
            </p>
          </div>
        )}

        {filtered.map(action => {
          const isOpen = expanded === action.id
          const isPending = action.status === 'pending'
          const isExpired = action.expires_at ? new Date(action.expires_at) < new Date() : false
          const canAct = isPending && !isExpired

          return (
            <div key={action.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 flex items-start gap-4">
                {/* Risk indicator */}
                <div className={`mt-0.5 h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${
                  isPending && !isExpired ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground'
                }`}>
                  {isPending && !isExpired
                    ? <Clock className="h-3.5 w-3.5" />
                    : action.status === 'executed' || action.status === 'confirmed'
                      ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                      : <X className="h-3.5 w-3.5 text-red-400" />
                  }
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm font-mono">{action.action_slug}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[action.status]}`}>
                      {STATUS_LABELS[action.status]}
                    </span>
                    {isExpired && isPending && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                        Expired
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {action.connection?.connector.name ?? '—'} ·{' '}
                    {action.connection?.label ?? '—'} ·{' '}
                    {action.requester?.email ?? action.user_id} ·{' '}
                    {relativeTime(action.created_at)}
                  </p>

                  {action.summary && (
                    <p className="text-sm text-muted-foreground/80 mt-1">{action.summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPending && action.expires_at && (
                    <span className={`text-[10px] ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                      {timeUntil(action.expires_at)}
                    </span>
                  )}
                  <button
                    onClick={() => toggleExpand(action)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                  >
                    <Eye className="h-3 w-3" />
                    Details
                  </button>
                </div>
              </div>

              {/* Expanded params + actions */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Parameters</p>
                    <pre className="text-xs bg-muted/30 rounded-lg p-3 overflow-x-auto text-foreground/70 font-mono">
                      {JSON.stringify(action.params, null, 2)}
                    </pre>
                  </div>

                  {/* #9 — impact preview */}
                  {(() => {
                    const pv = previews[action.id]
                    if (!pv) return null
                    if (pv.loading) return <p className="text-xs text-muted-foreground">Predicting impact…</p>
                    const destructive = pv.risk === 'destructive'
                    return (
                      <div className={`rounded-lg border p-3 ${destructive ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle className={`h-3.5 w-3.5 ${destructive ? 'text-red-400' : 'text-amber-400'}`} />
                          <p className="text-xs font-semibold">
                            {destructive ? 'Destructive — cannot be undone' : 'Write action'}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {pv.reversible ? 'reversible' : 'irreversible'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{pv.impact}</p>
                        {destructive && (
                          <div className="mt-2">
                            <label className="text-[11px] font-medium text-foreground">Rollback plan (required)</label>
                            <textarea
                              value={rollback[action.id] ?? ''}
                              onChange={e => setRollback(r => ({ ...r, [action.id]: e.target.value }))}
                              rows={2}
                              placeholder="How would you undo this if it goes wrong? (logged to the audit trail)"
                              className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {canAct && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approve(action.id)}
                        disabled={acting === action.id || (previews[action.id]?.risk === 'destructive' && !(rollback[action.id]?.trim()))}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {acting === action.id ? 'Executing…' : 'Approve & Execute'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reject(action.id)}
                        disabled={acting === action.id}
                        className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

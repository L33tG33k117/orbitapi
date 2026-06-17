'use client'

import { useEffect, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'

interface FeedbackRow {
  id: string
  message: string
  page_url: string | null
  status: string
  created_at: string
  user: { email: string; full_name: string | null } | null
  workspace: { name: string } | null
}

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <MessageSquarePlus className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-sm text-muted-foreground">{rows.length} note{rows.length === 1 ? '' : 's'} from testers</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">No feedback yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{r.user?.full_name || r.user?.email || 'Unknown'}</span>
                {r.workspace?.name && <span>· {r.workspace.name}</span>}
                {r.page_url && <span>· <code className="text-[11px]">{r.page_url}</code></span>}
                <span>· {new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

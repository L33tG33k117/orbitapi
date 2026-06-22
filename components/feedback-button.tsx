'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { MessageSquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CapturedError { message: string; source?: string; at: string }

interface MyFeedback { id: string; message: string; page_url: string | null; status: 'new' | 'acknowledged' | 'actioned'; created_at: string }

// Internal triage status → friendly, user-facing label + style.
const STATUS_VIEW: Record<MyFeedback['status'], { label: string; cls: string }> = {
  new: { label: 'Received', cls: 'bg-amber-500/15 text-amber-500' },
  acknowledged: { label: 'Reviewing', cls: 'bg-blue-500/15 text-blue-400' },
  actioned: { label: 'Done', cls: 'bg-emerald-500/15 text-emerald-500' },
}

// Install global JS-error listeners once per session into a capped ring buffer
// on window, so a feedback note can include whatever broke just before it.
function installErrorCapture() {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.__orbitErrorsInit) return
  w.__orbitErrorsInit = true
  w.__orbitErrors = (w.__orbitErrors as CapturedError[]) ?? []
  const push = (message: string, source?: string) => {
    w.__orbitErrors.push({ message: String(message).slice(0, 500), source, at: new Date().toISOString() })
    if (w.__orbitErrors.length > 10) w.__orbitErrors.shift()
  }
  window.addEventListener('error', (e: ErrorEvent) =>
    push(e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined))
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
    push(e.reason?.message ?? String(e.reason), 'unhandledrejection'))

  // Also capture console.error output (React warnings, caught-but-logged errors)
  // — often the only trace of a problem the user can see. Safe: wrapped so a
  // logging failure never recurses, and the original console.error still runs.
  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      const text = args.map(a => {
        try { return typeof a === 'string' ? a : (a as { message?: string })?.message ?? String(a) } catch { return '' }
      }).join(' ').trim()
      if (text) push(text, 'console.error')
    } catch { /* ignore */ }
    origError(...args)
  }
}

function collectDiagnostics() {
  if (typeof window === 'undefined') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return {
    path: window.location.pathname + window.location.search,
    errors: ((w.__orbitErrors as CapturedError[]) ?? []).slice(-5),
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    capturedAt: new Date().toISOString(),
  }
}

// Lightweight global "Send feedback" affordance for the beta. Lives in the TopBar.
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'send' | 'mine'>('send')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [mine, setMine] = useState<MyFeedback[] | null>(null)
  useEffect(() => { setMounted(true); installErrorCapture() }, [])

  async function loadMine() {
    setMine(null)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      setMine(res.ok ? (data.feedback ?? []) : [])
    } catch { setMine([]) }
  }

  // Load the user's history whenever they switch to the "My feedback" tab.
  useEffect(() => { if (open && tab === 'mine') loadMine() }, [open, tab])

  // Surface what we'll attach, so users know the report includes context.
  const diag = open && mounted ? collectDiagnostics() : undefined

  async function send() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
          diagnostics: collectDiagnostics(),
        }),
      })
      if (!res.ok) { toast.error('Could not send feedback.'); return }
      toast.success('Thanks for the feedback! 🙌')
      setMessage('')
      setOpen(false)
    } catch {
      toast.error('Could not send feedback.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Share feedback"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Feedback
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-auto w-full max-w-md rounded-2xl border bg-card p-5 space-y-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Feedback</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-4 border-b text-sm -mt-1">
              {(['send', 'mine'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2 -mb-px border-b-2 font-medium transition-colors ${
                    tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'send' ? 'Send feedback' : 'My feedback'}
                </button>
              ))}
            </div>

            {tab === 'send' ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Bugs, ideas, confusing bits — anything helps. We read every note.
                </p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="What's on your mind?"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {diag && (
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Attaching context to help us fix things: <code className="text-[10px]">{diag.path}</code>
                    {diag.errors.length > 0 && <> · <span className="text-amber-500">{diag.errors.length} recent error{diag.errors.length !== 1 ? 's' : ''}</span></>}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={send} disabled={sending || !message.trim()}>
                    {sending ? 'Sending…' : 'Send feedback'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {mine === null && <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>}
                {mine && mine.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">You haven&apos;t submitted any feedback yet.</p>
                )}
                <div className="space-y-2">
                  {(mine ?? []).map(f => {
                    const v = STATUS_VIEW[f.status]
                    return (
                      <div key={f.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 leading-snug">{f.message.length > 160 ? f.message.slice(0, 160) + '…' : f.message}</p>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.cls}`}>{v.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {f.page_url ? ` · ${f.page_url}` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {mine && mine.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-3">
                    <span className="font-medium text-foreground">Received</span> = we&apos;ve got it · <span className="font-medium text-foreground">Reviewing</span> = looking into it · <span className="font-medium text-foreground">Done</span> = shipped or actioned.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

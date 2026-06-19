'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { MessageSquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Lightweight global "Send feedback" affordance for the beta. Lives in the TopBar.
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
              <div>
                <h2 className="font-semibold">Share feedback</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bugs, ideas, confusing bits — anything helps. We read every note.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              autoFocus
              placeholder="What's on your mind?"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={send} disabled={sending || !message.trim()}>
                {sending ? 'Sending…' : 'Send feedback'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

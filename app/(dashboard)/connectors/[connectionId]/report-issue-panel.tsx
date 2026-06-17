'use client'

import { useState } from 'react'
import { Flag, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
  connectorSlug: string
  connectorName: string
}

export function ReportIssuePanel({ connectorSlug, connectorName }: Props) {
  const [open, setOpen] = useState(false)
  const [whatWrong, setWhatWrong] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!whatWrong.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/connector-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connector_slug: connectorSlug,
        connector_name: connectorName,
        what_wrong: whatWrong,
        error_message: errorMessage || null,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Report submitted</p>
          <p className="text-xs text-muted-foreground mt-1">
            The OrbitAPI team has been notified. We&apos;ll investigate and may reach out if we need more details.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium">Report an issue with this connector</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Tell us what&apos;s wrong. The OrbitAPI team will investigate and follow up.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="what-wrong">
              What&apos;s not working? <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="what-wrong"
              value={whatWrong}
              onChange={e => setWhatWrong(e.target.value)}
              rows={3}
              placeholder={`e.g. The "List tickets" action returns a 401 error even with a valid API key. The connector worked fine last week but stopped today.`}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">Be specific — describe what you expected vs. what happened.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="error-msg">
              Error message or log output <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="error-msg"
              value={errorMessage}
              onChange={e => setErrorMessage(e.target.value)}
              rows={2}
              placeholder="Paste any error messages, status codes, or logs here…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={submit}
              disabled={submitting || !whatWrong.trim()}
              className="gap-1.5"
            >
              <Flag className="h-3.5 w-3.5" />
              {submitting ? 'Submitting…' : 'Submit report'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

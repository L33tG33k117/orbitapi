'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface LicenseView {
  status: 'valid' | 'grace' | 'expired' | 'invalid' | 'absent'
  customer: string | null
  tier: string | null
  seats: number | null
  expiresAt: string | null
  daysRemaining: number
  message: string
  banner: { tone: 'none' | 'info' | 'warn' | 'error'; text: string }
}

interface Diff {
  customer: string
  tier: string
  seats: number | null
  expiresAt: string
}

const TONE: Record<string, string> = {
  info: 'border-primary/30 bg-primary/5',
  warn: 'border-amber-500/30 bg-amber-500/5',
  error: 'border-red-500/30 bg-red-500/5',
}

export function LicenseClient({ initial }: { initial: LicenseView }) {
  const router = useRouter()
  const [view] = useState(initial)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ from: Diff | null; to: Diff } | null>(null)

  async function check() {
    setBusy(true); setError(null); setPreview(null)
    const res = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, preview: true }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'That key could not be applied.'); return }
    setPreview({ from: data.from ?? null, to: data.to })
  }

  async function apply() {
    setBusy(true); setError(null)
    const res = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'That key could not be applied.'); return }
    setKey(''); setPreview(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {view.banner.tone !== 'none' && (
        <div className={`rounded-xl border p-4 ${TONE[view.banner.tone]}`}>
          <p className="text-sm">{view.banner.text}</p>
        </div>
      )}

      <div className="border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold">Current licence</h2>
        {view.status === 'absent' ? (
          <p className="text-sm text-muted-foreground">
            No licence has been applied. OrbitAPI still runs, with automation features limited,
            so you can evaluate it before a key is issued.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Licensed to</dt>
            <dd>{view.customer ?? '—'}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="capitalize">{view.tier ?? '—'}</dd>
            {view.seats && (<><dt className="text-muted-foreground">Seats</dt><dd>{view.seats}</dd></>)}
            <dt className="text-muted-foreground">Expires</dt>
            <dd>
              {view.expiresAt ? new Date(view.expiresAt).toLocaleDateString() : '—'}
              {view.status === 'valid' && view.daysRemaining > 0 && (
                <span className="text-muted-foreground"> · in {view.daysRemaining} days</span>
              )}
            </dd>
          </dl>
        )}
        {/* Said plainly, because it is the question an admin with a lapsed
            licence actually has, and the answer is reassuring. */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          Your data is never locked. Even with an expired licence you can read and export
          everything in this installation.
        </p>
      </div>

      <div className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Apply a licence key</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste the key support sent you. Changes to your licence arrive as a new key —
            there is nothing to activate online.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="key">Licence key</Label>
          <textarea
            id="key"
            value={key}
            onChange={e => setKey(e.target.value)}
            rows={4}
            placeholder="ORBIT.…"
            spellCheck={false}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {preview && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">This key would change your licence to:</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {preview.from && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Now</p>
                  <p>{preview.from.customer}</p>
                  <p className="capitalize text-muted-foreground">{preview.from.tier}{preview.from.seats ? ` · ${preview.from.seats} seats` : ''}</p>
                  <p className="text-muted-foreground">Expires {new Date(preview.from.expiresAt).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">After applying</p>
                <p>{preview.to.customer}</p>
                <p className="capitalize text-muted-foreground">{preview.to.tier}{preview.to.seats ? ` · ${preview.to.seats} seats` : ''}</p>
                <p className="text-muted-foreground">Expires {new Date(preview.to.expiresAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {preview ? (
            <>
              <Button onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply this licence'}</Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>Cancel</Button>
            </>
          ) : (
            <Button onClick={check} disabled={busy || !key.trim()}>
              {busy ? 'Checking…' : 'Check key'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

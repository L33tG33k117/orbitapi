'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, AlertTriangle, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Bundle {
  file: string
  sizeMb: number
  version: string | null
  verified: boolean
  isUpgrade: boolean
  command?: string
  error?: string
}

interface Payload {
  current: string
  released?: boolean
  updatesDir: string
  bundles: Bundle[]
}

export function UpdatesClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/updates')
    setData(await res.json().catch(() => null))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading && !data) return <p className="text-sm text-muted-foreground">Checking…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Currently running</p>
          <p className="text-2xl font-bold mt-0.5">{data?.current ?? 'unknown'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> {loading ? 'Checking…' : 'Check again'}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-2">
        <h2 className="text-base font-semibold">How updating works</h2>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Download the update from your OrbitAPI account, on any machine with internet.</li>
          <li>Copy the file into <code className="font-mono text-xs">{data?.updatesDir ?? 'updates/'}</code> on this server.</li>
          <li>Come back here — it will be checked automatically.</li>
          <li>Run the command shown, on the server.</li>
        </ol>
        {/* Worth explaining, because "why can't the button just do it?" is the
            obvious question and the answer is reassuring rather than lazy. */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          OrbitAPI checks the update but doesn&apos;t install it itself. Installing means
          restarting containers, which needs administrator access to the server — access this
          app deliberately does not have, so that a flaw in it could never be used to take over
          the machine.
        </p>
      </div>

      {data && data.bundles.length === 0 && (
        <div className="py-10 text-center border border-dashed rounded-xl text-muted-foreground">
          <PackageOpen className="h-8 w-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm">No update files found.</p>
          <p className="text-xs mt-1">Copy one into <code className="font-mono">{data.updatesDir}</code> and check again.</p>
        </div>
      )}

      {data?.bundles.map(b => (
        <div key={b.file} className={`rounded-xl border p-5 space-y-3 ${b.verified ? 'bg-card' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">
                {b.version ? `OrbitAPI ${b.version}` : b.file}
              </p>
              <p className="text-xs text-muted-foreground truncate">{b.file} · {b.sizeMb} MB</p>
            </div>
            {b.verified
              ? <span className="shrink-0 inline-flex items-center gap-1 text-xs text-emerald-500"><Check className="h-3.5 w-3.5" /> Checked</span>
              : <span className="shrink-0 inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Rejected</span>}
          </div>

          {!b.verified && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">This file failed its checks and must not be installed.</p>
              <p className="text-xs text-muted-foreground">
                It may have been damaged in transit, or it may not have come from us. Download it
                again from your OrbitAPI account.
              </p>
              {b.error && <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap mt-1">{b.error}</pre>}
            </div>
          )}

          {b.verified && !b.isUpgrade && (
            <p className="text-sm text-muted-foreground">
              This is not newer than what you&apos;re running. Installing it would move you
              backwards.
            </p>
          )}

          {b.verified && b.isUpgrade && b.command && (
            <div className="space-y-2">
              <p className="text-sm">Run this on the server to install it:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 text-xs font-mono">{b.command}</code>
                <Button
                  variant="outline" size="sm" className="shrink-0"
                  onClick={() => { navigator.clipboard.writeText(b.command!); setCopied(b.file); setTimeout(() => setCopied(null), 1600) }}
                >
                  {copied === b.file ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                It backs up your database first, and <code className="font-mono">./orbit.sh rollback</code> undoes
                the version change if anything looks wrong.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

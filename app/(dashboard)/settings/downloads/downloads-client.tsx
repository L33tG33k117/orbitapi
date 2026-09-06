'use client'

import { useState } from 'react'
import { Download, Copy, Check, Package, ShieldCheck, Terminal, KeyRound, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Release {
  version: string
  sizeBytes: number | null
  sha256: string
  changelog: string | null
  publishedAt: string
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  const mb = n / 1_048_576
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export function DownloadsClient({
  company, tier, seats, licenseExpiresAt, renewalRequestedAt,
  lastCheckinAt, lastSeenVersion, releases,
}: {
  company: string
  tier: string
  seats: number | null
  licenseExpiresAt: string | null
  renewalRequestedAt: string | null
  lastCheckinAt: string | null
  lastSeenVersion: string | null
  releases: Release[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(false)
  const [requested, setRequested] = useState(!!renewalRequestedAt)
  const [requesting, setRequesting] = useState(false)

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1600)
  }

  async function showKey() {
    setLoadingKey(true)
    const res = await fetch('/api/selfhost/me/license')
    const data = await res.json()
    setLoadingKey(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not load your licence key'); return }
    setLicenseKey(data.key)
  }

  async function requestRenewal() {
    setRequesting(true)
    const res = await fetch('/api/selfhost/me/renew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setRequesting(false)
    if (!res.ok) { toast.error('Could not send your request'); return }
    setRequested(true)
    toast.success('Renewal requested — we\'ll be in touch')
  }

  const latest = releases[0]
  const older = releases.slice(1)

  const daysLeft = licenseExpiresAt
    ? Math.ceil((new Date(licenseExpiresAt).getTime() - Date.now()) / 86_400_000)
    : null

  // The install reports what it is running, so we can tell a customer they are
  // behind without making them go and look.
  const behind = latest && lastSeenVersion && lastSeenVersion !== latest.version

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ licence ------- */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <span className="font-semibold">Your licence</span>
          {daysLeft !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
              daysLeft < 0 ? 'bg-red-500/15 text-red-400'
                : daysLeft <= 30 ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{company}</span>
          <span className="capitalize">{tier}</span>
          <span>{seats ? `${seats} seats` : 'Unlimited seats'}</span>
          {licenseExpiresAt && <span>Expires {new Date(licenseExpiresAt).toLocaleDateString()}</span>}
        </div>

        {licenseKey ? (
          <div className="space-y-1.5">
            <textarea
              readOnly
              value={licenseKey}
              onFocus={e => e.currentTarget.select()}
              className="w-full h-20 rounded-md border border-border bg-background p-2 font-mono text-[10px] break-all resize-none"
            />
            <button
              onClick={() => copy(licenseKey, 'key')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
            >
              {copied === 'key' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'key' ? 'Copied' : 'Copy key'}
            </button>
            <p className="text-[11px] text-muted-foreground pt-1">
              Paste this into <strong>Settings → Licence</strong> on your installation.
            </p>
          </div>
        ) : (
          <button
            onClick={showKey}
            disabled={loadingKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {loadingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Show my licence key
          </button>
        )}

        {/* Offered from 60 days out, and always once expired — early enough to
            act on, late enough not to be noise. */}
        {daysLeft !== null && daysLeft <= 60 && (
          requested ? (
            <p className="text-xs text-emerald-400 border-t border-border pt-3">
              Renewal requested. We&apos;ll be in touch — no need to ask again.
            </p>
          ) : (
            <div className="border-t border-border pt-3">
              <button
                onClick={requestRenewal}
                disabled={requesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Request a renewal
              </button>
            </div>
          )
        )}

        {lastCheckinAt && (
          <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
            Your installation last checked in {new Date(lastCheckinAt).toLocaleDateString()}
            {lastSeenVersion && <> running <span className="font-mono">{lastSeenVersion}</span></>}.
          </p>
        )}
      </div>

      {/* ------------------------------------------------ downloads ----- */}
      {releases.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
          No builds have been published yet. We&apos;ll email you when the first one is ready.
        </div>
      ) : (
        <>
          {behind && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
              Your installation is running <span className="font-mono">{lastSeenVersion}</span>.{' '}
              <span className="font-mono">{latest.version}</span> is available below.
            </div>
          )}

          {/* The latest build gets the whole treatment: this is the one almost
              everybody wants, and burying it in a list is how people end up
              installing a version we stopped supporting. */}
          <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="font-semibold">OrbitAPI {latest.version}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wide">Latest</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {formatBytes(latest.sizeBytes)} · {new Date(latest.publishedAt).toLocaleDateString()}
              </span>
            </div>

            {latest.changelog && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latest.changelog}</p>
            )}

            <a
              href={`/api/downloads/${latest.version}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" /> Download {latest.version}
            </a>

            <Checksum sha={latest.sha256} copied={copied === latest.version} onCopy={() => copy(latest.sha256, latest.version)} />

            <InstallSteps version={latest.version} onCopy={copy} copied={copied} />
          </div>

          {older.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Earlier versions</p>
              {older.map(r => (
                <div key={r.version} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <span className="font-mono text-sm">{r.version}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(r.sizeBytes)} · {new Date(r.publishedAt).toLocaleDateString()}
                  </span>
                  <a
                    href={`/api/downloads/${r.version}`}
                    className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Checksum({ sha, copied, onCopy }: { sha: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        {/* Shown before the download, not after, so it can be checked against
            what actually landed on disk rather than against itself. */}
        <span>Verify what you downloaded against this checksum:</span>
      </div>
      <button
        onClick={onCopy}
        className="flex items-center gap-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[10px] break-all text-left hover:bg-muted transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
        <span className="break-all">{sha}</span>
      </button>
    </div>
  )
}

/**
 * The four commands, in order, with nothing between them and the customer.
 *
 * These were previously only in docs/SELF_HOST.md, which meant getting from
 * "I have the file" to "it is running" required finding a document nobody had
 * linked. Install and update differ by exactly one command, so both are here.
 */
function InstallSteps({ version, onCopy, copied }: {
  version: string
  onCopy: (text: string, id: string) => void
  copied: string | null
}) {
  const bundle = `orbit-selfhost-${version}.tar.gz`
  const steps: { id: string; label: string; cmd: string }[] = [
    { id: 'verify', label: 'Check the file arrived intact', cmd: `sha256sum ${bundle}` },
    { id: 'extract', label: 'Unpack it', cmd: `tar -xzf ${bundle} && cd orbit-selfhost-${version}` },
    { id: 'install', label: 'First time on this machine', cmd: 'sudo ./orbit.sh install' },
    { id: 'update', label: 'Already running an older version', cmd: `sudo ./orbit.sh update ../${bundle}` },
  ]

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Terminal className="h-3.5 w-3.5" /> On your server
      </div>
      {steps.map(s => (
        <div key={s.id} className="space-y-1">
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
          <button
            onClick={() => onCopy(s.cmd, s.id)}
            className="flex items-center gap-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-left hover:bg-muted transition-colors"
          >
            {copied === s.id ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
            <span className="break-all">{s.cmd}</span>
          </button>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground pt-1">
        An update backs up your database first and can be undone with{' '}
        <code className="text-[10px]">./orbit.sh rollback</code>.
      </p>
    </div>
  )
}

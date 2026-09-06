'use client'

import { useEffect, useState } from 'react'
import {
  Server, Plus, KeyRound, Copy, Check, RefreshCw, Download, Ban,
  AlertTriangle, Trash2, Mail, Package, ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'

// The commercial side of the self-hosted edition: who bought it, what we
// signed for them, and which builds they can fetch. Before this page existed
// the whole flow was a CLI script and an email, and nothing was written down.

type CustomerStatus = 'active' | 'suspended' | 'churned'

interface Customer {
  id: string
  company: string
  contact_name: string | null
  contact_email: string
  user_id: string | null
  tier: string
  seats: number | null
  downloads_enabled: boolean
  status: CustomerStatus
  notes: string | null
  license_id: string | null
  license_issued_at: string | null
  license_expires_at: string | null
  created_at: string
  revoked_at: string | null
  revoked_reason: string | null
  renewal_requested_at: string | null
  renewal_note: string | null
  last_checkin_at: string | null
  last_seen_version: string | null
}

interface Release {
  version: string
  size_bytes: number | null
  sha256: string
  changelog: string | null
  channel: string
  yanked: boolean
  published_at: string
}

const TIERS = ['free', 'starter', 'pro', 'enterprise']

const STATUS_STYLES: Record<CustomerStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  suspended: 'bg-amber-500/15 text-amber-400',
  churned: 'bg-muted text-muted-foreground',
}

/** Licence health, in the words a support conversation actually uses. */
function licenceState(c: Customer): { label: string; style: string } {
  if (c.revoked_at) return { label: 'Revoked', style: 'bg-red-500/15 text-red-400' }
  if (!c.license_expires_at) return { label: 'Never issued', style: 'bg-muted text-muted-foreground' }

  const days = Math.ceil((new Date(c.license_expires_at).getTime() - Date.now()) / 86_400_000)

  // Mirrors the 30-day grace in lib/license.ts. Past expiry the install still
  // works for a month — saying "expired" without that context makes an admin
  // panic about a customer who is fine.
  if (days < -30) return { label: 'Lapsed', style: 'bg-red-500/15 text-red-400' }
  if (days < 0) return { label: `In grace (${30 + days}d)`, style: 'bg-red-500/15 text-red-400' }
  if (days <= 30) return { label: `Expires in ${days}d`, style: 'bg-amber-500/15 text-amber-400' }
  return { label: `${days}d left`, style: 'bg-emerald-500/15 text-emerald-400' }
}

function formatBytes(n: number | null): string {
  if (!n) return '—'
  const mb = n / 1_048_576
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export default function AdminSelfhostPage() {
  const [tab, setTab] = useState<'customers' | 'releases'>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [canIssue, setCanIssue] = useState(true)
  const [migrated, setMigrated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/selfhost/customers').then(r => r.json()),
      fetch('/api/admin/selfhost/releases').then(r => r.json()),
    ])
      .then(([c, r]) => {
        setCustomers(Array.isArray(c?.customers) ? c.customers : [])
        setCanIssue(Boolean(c?.canIssue))
        setMigrated(c?.migrated !== false)
        setReleases(Array.isArray(r) ? r : [])
      })
      .catch(() => toast.error('Could not load self-hosted data'))
      .finally(() => setLoading(false))
  }, [])

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1600)
  }

  async function createCustomer(form: FormData) {
    const seatsRaw = String(form.get('seats') ?? '').trim()
    const res = await fetch('/api/admin/selfhost/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: form.get('company'),
        contactName: form.get('contactName'),
        contactEmail: form.get('contactEmail'),
        tier: form.get('tier'),
        seats: seatsRaw ? Number(seatsRaw) : null,
        notes: form.get('notes'),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Could not add customer'); return }
    setCustomers(prev => [data, ...prev])
    setCreating(false)
    toast.success(`${data.company} added — issue them a licence next`)
  }

  async function issue(c: Customer, months: number) {
    setBusy(c.id)
    const res = await fetch(`/api/admin/selfhost/customers/${c.id}/license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) { toast.error(data.error ?? 'Could not issue licence'); return }

    setCustomers(prev => prev.map(x => x.id === c.id ? {
      ...x,
      license_id: data.licenseId,
      license_issued_at: data.issuedAt,
      license_expires_at: data.expiresAt,
    } : x))
    setRevealed(prev => ({ ...prev, [c.id]: data.key }))
    await copy(data.key, c.id)
    toast.success('Licence issued and copied to your clipboard')
  }

  async function reveal(c: Customer) {
    setBusy(c.id)
    const res = await fetch(`/api/admin/selfhost/customers/${c.id}/license`)
    const data = await res.json()
    setBusy(null)
    if (!res.ok) { toast.error(data.error ?? 'No licence to show'); return }
    setRevealed(prev => ({ ...prev, [c.id]: data.key }))
  }

  async function patch(c: Customer, body: Record<string, unknown>, optimistic: Partial<Customer>) {
    setBusy(c.id)
    const res = await fetch(`/api/admin/selfhost/customers/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(null)
    if (!res.ok) { toast.error('Could not update'); return }
    setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, ...optimistic } : x))
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.company} and their entire licence history?\n\nTheir installed licence keeps working — it is signed and checks nothing against us. Use "Churned" instead if they simply left.`)) return
    setBusy(c.id)
    const res = await fetch(`/api/admin/selfhost/customers/${c.id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { toast.error('Could not delete'); return }
    setCustomers(prev => prev.filter(x => x.id !== c.id))
    toast.success('Customer deleted')
  }

  async function setRevoked(c: Customer, revoked: boolean) {
    let reason: string | null = null
    if (revoked) {
      reason = prompt(
        `Withdraw ${c.company}'s licence?\n\n` +
        'This stops their downloads and licence retrieval immediately, and their ' +
        'installation collapses to the free tier at its next check-in.\n\n' +
        'It CANNOT reach an air-gapped install — their signed key works until it expires.\n\n' +
        'Reason (shown to their administrator):',
        'This licence has been withdrawn. Please contact OrbitAPI support.',
      )
      if (reason === null) return
    } else if (!confirm(`Reinstate ${c.company}'s licence?`)) {
      return
    }

    await patch(
      c,
      { revoked, revokedReason: reason },
      { revoked_at: revoked ? new Date().toISOString() : null, revoked_reason: reason },
    )
    toast.success(revoked ? 'Licence withdrawn' : 'Licence reinstated')
  }

  async function clearRenewal(c: Customer) {
    await patch(c, { clearRenewalRequest: true }, { renewal_requested_at: null, renewal_note: null })
    toast.success('Renewal request cleared')
  }

  async function setYanked(version: string, yanked: boolean) {
    setBusy(version)
    const res = await fetch('/api/admin/selfhost/releases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, yanked }),
    })
    setBusy(null)
    if (!res.ok) { toast.error('Could not update release'); return }
    setReleases(prev => prev.map(r => r.version === version ? { ...r, yanked } : r))
    toast.success(yanked ? `${version} pulled from downloads` : `${version} available again`)
  }

  const renewalRequests = customers.filter(c => c.renewal_requested_at)
  const active = customers.filter(c => c.status === 'active')
  const expiringSoon = active.filter(c => {
    if (!c.license_expires_at) return false
    const days = Math.ceil((new Date(c.license_expires_at).getTime() - Date.now()) / 86_400_000)
    return days <= 30
  })

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2.5">
        <Server className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Self-hosted</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active · {expiringSoon.length} needing renewal · {releases.filter(r => !r.yanked).length} builds published
          </p>
        </div>
      </div>

      {!migrated && (
        <Notice tone="amber">
          Migration <code className="text-xs">056_selfhost_customers</code> has not been applied yet, so
          nothing can be saved. Run <code className="text-xs">npm run db:up</code> against this database.
        </Notice>
      )}

      {migrated && !canIssue && (
        <Notice tone="amber">
          No signing key is configured, so licences cannot be issued. Set{' '}
          <code className="text-xs">LICENSE_SIGNING_KEY</code> in the environment to the private half
          of key <code className="text-xs">k1</code> — the same key whose public half is in{' '}
          <code className="text-xs">lib/license.ts</code>. Everything else on this page still works.
        </Notice>
      )}

      {renewalRequests.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <p className="text-primary">
            {renewalRequests.length === 1
              ? `${renewalRequests[0].company} has asked to renew.`
              : `${renewalRequests.length} customers have asked to renew.`}{' '}
            Each is marked below — renewing clears the request.
          </p>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <Notice tone="amber">
          {expiringSoon.length === 1
            ? `${expiringSoon[0].company}'s licence needs renewing.`
            : `${expiringSoon.length} licences need renewing within 30 days.`}{' '}
          Their installs keep working for 30 days past expiry, then automation pauses — their data
          is never locked.
        </Notice>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['customers', 'releases'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t} ({t === 'customers' ? customers.length : releases.length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : tab === 'customers' ? (
        <div className="space-y-3">
          {creating ? (
            <form
              action={createCustomer}
              className="rounded-xl border border-primary/30 bg-card p-4 space-y-3"
            >
              <p className="text-sm font-semibold">New self-hosted customer</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field name="company" label="Company" required placeholder="Acme Ltd" />
                <Field name="contactEmail" label="Contact email" required type="email" placeholder="ops@acme.com" hint="Also how they get download access when they sign in." />
                <Field name="contactName" label="Contact name" placeholder="Cody Woods" />
                <Field name="seats" label="Seats" type="number" placeholder="Unlimited if blank" />
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">Tier</span>
                  <select name="tier" defaultValue="enterprise" className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm capitalize">
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <Field name="notes" label="Notes" placeholder="PO number, contract ref…" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">Add customer</button>
                <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add customer
            </button>
          )}

          {customers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
              No self-hosted customers yet.
            </div>
          ) : customers.map(c => {
            const lic = licenceState(c)
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{c.company}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${lic.style}`}>{lic.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <a href={`mailto:${c.contact_email}`} className="text-primary hover:underline">{c.contact_email}</a>
                      <span className="capitalize">{c.tier}</span>
                      <span>{c.seats ? `${c.seats} seats` : 'Unlimited seats'}</span>
                      {!c.user_id && <span className="text-amber-400/80">· no cloud account yet</span>}
                    </div>
                  </div>
                </div>

                {c.renewal_requested_at && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 space-y-1">
                    <p className="text-xs text-primary font-medium">
                      Renewal requested {new Date(c.renewal_requested_at).toLocaleDateString()}
                    </p>
                    {c.renewal_note && <p className="text-xs text-muted-foreground">{c.renewal_note}</p>}
                    <button
                      onClick={() => clearRenewal(c)}
                      disabled={busy === c.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                    >
                      Dismiss without renewing
                    </button>
                  </div>
                )}

                {c.revoked_at && (
                  <p className="text-xs text-red-400">
                    Withdrawn {new Date(c.revoked_at).toLocaleDateString()}
                    {c.revoked_reason && <> — {c.revoked_reason}</>}
                  </p>
                )}

                {c.license_id && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Licence {c.license_id.slice(0, 8)} · issued {new Date(c.license_issued_at!).toLocaleDateString()} · expires {new Date(c.license_expires_at!).toLocaleDateString()}
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  {c.last_checkin_at
                    ? <>Last checked in {new Date(c.last_checkin_at).toLocaleDateString()}
                        {c.last_seen_version && <> running <span className="font-mono">{c.last_seen_version}</span></>}</>
                    // Not a fault. An air-gapped install is the case this whole
                    // edition exists for, and it will never check in.
                    : 'Never checked in — air-gapped, or check-in turned off.'}
                </p>

                {revealed[c.id] && (
                  <div className="space-y-1.5">
                    <textarea
                      readOnly
                      value={revealed[c.id]}
                      onFocus={e => e.currentTarget.select()}
                      className="w-full h-20 rounded-md border border-border bg-background p-2 font-mono text-[10px] break-all resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copy(revealed[c.id], c.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted">
                        {copied === c.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === c.id ? 'Copied' : 'Copy key'}
                      </button>
                      <a
                        href={`mailto:${c.contact_email}?subject=${encodeURIComponent('Your OrbitAPI self-hosted licence')}&body=${encodeURIComponent(
                          `Hi${c.contact_name ? ` ${c.contact_name}` : ''},\n\nHere is your OrbitAPI licence key. Paste it into Settings → Licence on your installation.\n\n${revealed[c.id]}\n\nDownloads and update bundles are at ${typeof window !== 'undefined' ? window.location.origin : ''}/downloads — sign in with ${c.contact_email}.\n\nThanks,\nOrbitAPI`
                        )}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted"
                      >
                        <Mail className="h-3.5 w-3.5" /> Email it
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => issue(c, 12)}
                    disabled={busy === c.id || !canIssue}
                    title={canIssue ? '' : 'LICENSE_SIGNING_KEY is not configured'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-40"
                  >
                    {c.license_id ? <RefreshCw className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {c.license_id ? 'Renew 12 months' : 'Issue 12-month licence'}
                  </button>

                  {c.license_id && !revealed[c.id] && (
                    <button onClick={() => reveal(c)} disabled={busy === c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted disabled:opacity-50">
                      <KeyRound className="h-3.5 w-3.5" /> Show current key
                    </button>
                  )}

                  <button
                    onClick={() => patch(c, { downloadsEnabled: !c.downloads_enabled }, { downloads_enabled: !c.downloads_enabled })}
                    disabled={busy === c.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border disabled:opacity-50 ${
                      c.downloads_enabled ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" /> {c.downloads_enabled ? 'Downloads on' : 'Downloads off'}
                  </button>

                  <select
                    value={c.status}
                    onChange={e => patch(c, { status: e.target.value }, { status: e.target.value as CustomerStatus })}
                    disabled={busy === c.id}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="churned">Churned</option>
                  </select>

                  <button
                    onClick={() => setRevoked(c, !c.revoked_at)}
                    disabled={busy === c.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border disabled:opacity-50 ${
                      c.revoked_at
                        ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> {c.revoked_at ? 'Reinstate licence' : 'Withdraw licence'}
                  </button>

                  <button onClick={() => remove(c)} disabled={busy === c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>

                {c.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{c.notes}</p>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <Notice tone="muted">
            Builds appear here automatically when a <code className="text-xs">selfhost-v*</code> tag is
            pushed. Customers with downloads enabled see the un-pulled ones at{' '}
            <code className="text-xs">/downloads</code>.
          </Notice>

          {releases.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
              No releases published yet. Push a <code className="text-xs">selfhost-v1.0.0</code> tag to cut one.
            </div>
          ) : releases.map(r => (
            <div key={r.version} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm font-mono">{r.version}</span>
                {r.channel !== 'stable' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold uppercase">{r.channel}</span>}
                {r.yanked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold uppercase">Pulled</span>}
                <span className="text-xs text-muted-foreground ml-auto">{formatBytes(r.size_bytes)} · {new Date(r.published_at).toLocaleDateString()}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground break-all">sha256 {r.sha256}</p>
              {r.changelog && <p className="text-xs whitespace-pre-wrap text-muted-foreground border-t border-border pt-2">{r.changelog}</p>}
              <button
                onClick={() => setYanked(r.version, !r.yanked)}
                disabled={busy === r.version}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" /> {r.yanked ? 'Restore to downloads' : 'Pull from downloads'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'amber' | 'muted'; children: React.ReactNode }) {
  if (tone === 'muted') {
    return <p className="text-xs text-muted-foreground rounded-xl border border-border px-4 py-3">{children}</p>
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-amber-200/90">{children}</p>
    </div>
  )
}

function Field({ name, label, hint, ...rest }: {
  name: string; label: string; hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-xs space-y-1">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        {...rest}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
      />
      {hint && <span className="block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  )
}

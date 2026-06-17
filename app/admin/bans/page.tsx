'use client'

import { useEffect, useState } from 'react'
import { Ban, Plus, Trash2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BanRecord {
  id: string
  ban_type: 'user_id' | 'email' | 'email_domain' | 'ip'
  value: string
  reason: string | null
  created_at: string
  expires_at: string | null
  banned_by_profile: { email: string; full_name: string | null } | null
}

const BAN_TYPE_LABELS = {
  user_id: 'User ID',
  email: 'Email',
  email_domain: 'Email Domain',
  ip: 'IP Address',
}

const BAN_TYPE_PLACEHOLDERS = {
  user_id: 'uuid-of-user',
  email: 'user@example.com',
  email_domain: 'example.com',
  ip: '192.168.1.1',
}

export default function BansPage() {
  const [bans, setBans] = useState<BanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    ban_type: 'email' as BanRecord['ban_type'],
    value: '',
    reason: '',
    expires_at: '',
  })

  useEffect(() => {
    fetch('/api/admin/bans')
      .then(r => r.json())
      .then(data => { setBans(data); setLoading(false) })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.value.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/bans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ban_type: form.ban_type,
        value: form.value.trim(),
        reason: form.reason.trim() || undefined,
        expires_at: form.expires_at || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create ban')
    } else {
      setBans(prev => [data, ...prev])
      setForm({ ban_type: 'email', value: '', reason: '', expires_at: '' })
      setCreating(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this ban?')) return
    await fetch(`/api/admin/bans/${id}`, { method: 'DELETE' })
    setBans(prev => prev.filter(b => b.id !== id))
  }

  const now = new Date()
  const active = bans.filter(b => !b.expires_at || new Date(b.expires_at) > now)
  const expired = bans.filter(b => b.expires_at && new Date(b.expires_at) <= now)

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Ban className="h-4 w-4 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Platform Bans</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Block users, emails, email domains, or IP addresses from using OrbitAPI.</p>
        </div>
        <Button onClick={() => setCreating(!creating)} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Add ban
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <Shield className="h-4 w-4" /> New ban
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Ban type</label>
              <select
                value={form.ban_type}
                onChange={e => setForm(f => ({ ...f, ban_type: e.target.value as BanRecord['ban_type'] }))}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {Object.entries(BAN_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Value</label>
              <Input
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={BAN_TYPE_PLACEHOLDERS[form.ban_type]}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Reason (optional)</label>
              <Input
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Spam, abuse, ToS violation…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Expires (optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving || !form.value.trim()} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
              {saving ? 'Banning…' : 'Ban'}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active bans */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Active bans ({active.length})</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : active.length === 0 ? (
          <div className="py-10 text-center border border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground">No active bans.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y divide-border/50">
            {active.map(ban => (
              <div key={ban.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      {BAN_TYPE_LABELS[ban.ban_type]}
                    </span>
                    <p className="text-sm font-mono font-medium">{ban.value}</p>
                  </div>
                  {ban.reason && <p className="text-xs text-muted-foreground mt-0.5">{ban.reason}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Banned {new Date(ban.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {ban.expires_at && ` · Expires ${new Date(ban.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    {ban.banned_by_profile && ` · by ${ban.banned_by_profile.full_name ?? ban.banned_by_profile.email}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(ban.id)}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {expired.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Expired bans ({expired.length})</h2>
          <div className="rounded-xl border bg-muted/5 divide-y divide-border/50 opacity-60">
            {expired.map(ban => (
              <div key={ban.id} className="flex items-center gap-4 px-5 py-2.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{BAN_TYPE_LABELS[ban.ban_type]}</span>
                <p className="text-sm font-mono flex-1">{ban.value}</p>
                <p className="text-[11px] text-muted-foreground shrink-0">Expired {new Date(ban.expires_at!).toLocaleDateString()}</p>
                <button onClick={() => handleDelete(ban.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

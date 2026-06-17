'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, Users, Plug, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WorkspaceTier, FeatureFlags } from '@/types'
import { CAPABILITY_INFO, TIER_CAPABILITIES, hasCapability, type Capability } from '@/lib/entitlements'

interface Member {
  id: string
  role: string
  profile: { id: string; email: string; full_name: string | null; super_admin: boolean }
}

interface Connection {
  id: string
  label: string
  status: string
  connector: { name: string; slug: string } | null
}

interface Skill {
  id: string
  name: string
  autonomy: string
  enabled: boolean
}

interface WorkspaceDetail {
  id: string
  name: string
  tier: WorkspaceTier
  feature_flags: FeatureFlags
  ai_credit_override: number | null
  created_at: string
}

const TIER_STYLES: Record<WorkspaceTier, string> = {
  free: 'bg-slate-500/15 text-slate-300',
  starter: 'bg-blue-500/15 text-blue-300',
  pro: 'bg-indigo-500/15 text-indigo-300',
  enterprise: 'bg-amber-500/15 text-amber-300',
}

const TIER_OPTIONS: WorkspaceTier[] = ['free', 'starter', 'pro', 'enterprise']

const ALL_CAPABILITIES = Object.keys(CAPABILITY_INFO) as Capability[]

// Override state per capability: 'default' (inherit tier), 'on' (force grant), 'off' (force revoke).
type OverrideState = 'default' | 'on' | 'off'
function overrideState(flags: FeatureFlags, cap: Capability): OverrideState {
  const v = flags[cap]
  return v === true ? 'on' : v === false ? 'off' : 'default'
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ workspace: WorkspaceDetail; members: Member[]; connections: Connection[]; skills: Skill[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tier, setTier] = useState<WorkspaceTier>('free')
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [creditOverride, setCreditOverride] = useState<string>('')

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/workspaces/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d || d.error || !d.workspace) {
          setError(d?.error ?? 'Could not load this workspace.')
          setLoading(false)
          return
        }
        setData(d)
        setTier(d.workspace.tier)
        setFlags(d.workspace.feature_flags ?? {})
        setCreditOverride(d.workspace.ai_credit_override != null ? String(d.workspace.ai_credit_override) : '')
        setLoading(false)
      })
      .catch(() => { setError('Could not load this workspace.'); setLoading(false) })
  }, [id])

  function setOverride(cap: Capability, state: OverrideState) {
    setFlags(prev => {
      const next = { ...prev }
      if (state === 'default') delete next[cap]
      else next[cap] = state === 'on'
      return next
    })
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        feature_flags: flags,
        ai_credit_override: creditOverride.trim() === '' ? null : Number(creditOverride),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>
  }

  if (error || !data) {
    return (
      <div className="p-8 space-y-4 max-w-2xl">
        <Link href="/admin/workspaces" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Workspaces
        </Link>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-400">Couldn&apos;t load this workspace</p>
          <p className="text-sm text-muted-foreground mt-1">{error ?? 'Unknown error.'}</p>
        </div>
      </div>
    )
  }

  const { workspace } = data
  const members = data.members ?? []
  const connections = data.connections ?? []
  const skills = data.skills ?? []
  const owner = members.find(m => m.role === 'owner')

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <Link href="/admin/workspaces" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Workspaces
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <p className="text-sm text-muted-foreground">
              Owner: {owner?.profile.email ?? '—'} · Created {new Date(workspace.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Members', value: members.length, icon: Users },
          { label: 'Connections', value: connections.length, icon: Plug },
          { label: 'Skills', value: skills.length, icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <h2 className="text-sm font-semibold">Plan & features</h2>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Tier</p>
          <div className="flex gap-2">
            {TIER_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all border ${
                  tier === t
                    ? TIER_STYLES[t] + ' border-current'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">AI credit override</p>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              value={creditOverride}
              onChange={e => setCreditOverride(e.target.value)}
              placeholder="Plan default"
              className="max-w-[200px]"
            />
            {creditOverride.trim() !== '' && (
              <button onClick={() => setCreditOverride('')} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Reset to plan default
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Leave blank to use the plan&apos;s monthly credit allowance. Set a number to override (custom/enterprise
            deals, comped testers).
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Capabilities</p>
          <p className="text-[11px] text-muted-foreground -mt-1">
            <strong>Default</strong> follows the plan; <strong>On</strong>/<strong>Off</strong> override it for this workspace.
          </p>
          <div className="space-y-1.5 pt-1">
            {ALL_CAPABILITIES.map(cap => {
              const state = overrideState(flags, cap)
              const effective = hasCapability(tier, flags, cap)
              const tierDefault = TIER_CAPABILITIES[tier].includes(cap)
              return (
                <div key={cap} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {CAPABILITY_INFO[cap].label}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${effective ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {effective ? 'available' : 'locked'}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Plan default: {tierDefault ? 'available' : 'locked'}
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                    {(['default', 'on', 'off'] as OverrideState[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setOverride(cap, s)}
                        className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                          state === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Button onClick={save} disabled={saving} size="sm" className={saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-border">
          {members.map(m => (
            <div key={m.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{m.profile.full_name || m.profile.email.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground">{m.profile.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.profile.super_admin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold uppercase tracking-wide">super admin</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{m.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Connections ({connections.length})</h2>
        </div>
        <div className="divide-y divide-border">
          {connections.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.connector?.name ?? '—'}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                ${c.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                  c.status === 'error' ? 'bg-red-500/15 text-red-400' :
                  'bg-muted text-muted-foreground'}`}>
                {c.status}
              </span>
            </div>
          ))}
          {connections.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted-foreground">No connections</p>
          )}
        </div>
      </div>
    </div>
  )
}

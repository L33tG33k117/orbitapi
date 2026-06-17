import { createAdminClient } from '@/lib/supabase/admin'
import { Building2, Users, Plug, Zap } from 'lucide-react'
import type { WorkspaceTier } from '@/types'

const TIER_STYLES: Record<WorkspaceTier, string> = {
  free: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  starter: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  pro: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  enterprise: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient()

  const [
    { count: workspaceCount },
    { count: userCount },
    { count: connectionCount },
    { count: skillCount },
    { data: recentWorkspaces },
    { data: recentUsers },
    { data: allWorkspaces },
  ] = await Promise.all([
    admin.from('workspaces').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('connections').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('skills').select('*', { count: 'exact', head: true }).eq('enabled', true),
    admin.from('workspaces').select('id, name, tier, created_at').order('created_at', { ascending: false }).limit(8),
    admin.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }).limit(8),
    admin.from('workspaces').select('tier'),
  ])

  const tiers: Record<WorkspaceTier, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 }
  for (const w of (allWorkspaces ?? [])) {
    const t = w.tier as WorkspaceTier
    tiers[t] = (tiers[t] ?? 0) + 1
  }

  const stats = [
    { label: 'Total workspaces', value: workspaceCount ?? 0, icon: Building2, color: 'text-indigo-400' },
    { label: 'Total users', value: userCount ?? 0, icon: Users, color: 'text-emerald-400' },
    { label: 'Active connections', value: connectionCount ?? 0, icon: Plug, color: 'text-blue-400' },
    { label: 'Active skills', value: skillCount ?? 0, icon: Zap, color: 'text-amber-400' },
  ]

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-3xl font-bold tabular-nums">{stat.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Tier distribution</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['free', 'starter', 'pro'] as WorkspaceTier[]).map(tier => (
            <div key={tier} className={`rounded-lg border p-4 ${TIER_STYLES[tier]}`}>
              <p className="text-2xl font-bold tabular-nums">{tiers[tier]}</p>
              <p className="text-xs font-semibold uppercase tracking-wider mt-1 capitalize">{tier}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold">Recent workspaces</h2>
          </div>
          <div className="divide-y divide-border">
            {(recentWorkspaces ?? []).map(w => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-medium truncate flex-1 mr-3">{w.name}</p>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize shrink-0 border ${TIER_STYLES[w.tier as WorkspaceTier]}`}>
                  {w.tier}
                </span>
              </div>
            ))}
            {!recentWorkspaces?.length && (
              <p className="px-5 py-4 text-sm text-muted-foreground">No workspaces yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold">Recent users</h2>
          </div>
          <div className="divide-y divide-border">
            {(recentUsers ?? []).map(u => (
              <div key={u.id} className="px-5 py-3">
                <p className="text-sm font-medium">{u.full_name || u.email.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
            ))}
            {!recentUsers?.length && (
              <p className="px-5 py-4 text-sm text-muted-foreground">No users yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlertTriangle, Building2, Users, Plug, Activity, TrendingDown } from 'lucide-react'
import { ConnectorToggle } from './connector-toggle'
import { catalog } from '@/connectors/catalog'

export default async function AnalyticsPage() {
  const user = await requireSuperAdmin()
  if (!user) redirect('/dashboard')

  const admin = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: workspaces },
    { data: allMemberships },
    { data: allConnections },
    { data: auditMonth },
    { data: disabledOverrides },
  ] = await Promise.all([
    admin.from('workspaces').select('id, name, tier, created_at').order('created_at', { ascending: false }),
    admin.from('memberships').select('workspace_id, user_id'),
    admin.from('connections').select('workspace_id, id, status').eq('status', 'active'),
    admin.from('audit_log').select('workspace_id').gte('created_at', monthStart),
    admin.from('connector_overrides').select('slug, disabled, disabled_reason'),
  ])

  const memberMap: Record<string, number> = {}
  for (const m of allMemberships ?? []) memberMap[m.workspace_id] = (memberMap[m.workspace_id] ?? 0) + 1

  const connMap: Record<string, number> = {}
  for (const c of allConnections ?? []) connMap[c.workspace_id] = (connMap[c.workspace_id] ?? 0) + 1

  const callMap: Record<string, number> = {}
  for (const a of auditMonth ?? []) callMap[a.workspace_id] = (callMap[a.workspace_id] ?? 0) + 1

  const wsStats = (workspaces ?? []).map(ws => ({
    ...ws,
    members: memberMap[ws.id] ?? 0,
    connections: connMap[ws.id] ?? 0,
    callsThisMonth: callMap[ws.id] ?? 0,
  }))

  const totalCalls = wsStats.reduce((s, w) => s + w.callsThisMonth, 0)
  const avgCalls = wsStats.length > 0 ? Math.round(totalCalls / wsStats.length) : 0
  const HIGH_THRESHOLD = Math.max(avgCalls * 3, 100)

  const highUsage = wsStats.filter(w => w.callsThisMonth > HIGH_THRESHOLD).sort((a, b) => b.callsThisMonth - a.callsThisMonth)
  const noUsage = wsStats.filter(w => w.callsThisMonth === 0 && w.connections > 0)
  const unconnected = wsStats.filter(w => w.connections === 0)

  const overrideMap: Record<string, { disabled: boolean; disabled_reason: string | null }> = {}
  for (const o of disabledOverrides ?? []) overrideMap[o.slug] = { disabled: o.disabled, disabled_reason: o.disabled_reason }

  const availableSlugs = new Set(catalog.filter(e => e.available).map(e => e.slug))
  const managedConnectors = catalog
    .filter(e => availableSlugs.has(e.slug))
    .map(e => ({
      slug: e.slug,
      name: e.name,
      category: e.category,
      disabled: overrideMap[e.slug]?.disabled ?? false,
      disabled_reason: overrideMap[e.slug]?.disabled_reason ?? null,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const tierColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    starter: 'bg-blue-500/10 text-blue-400',
    pro: 'bg-primary/10 text-primary',
    enterprise: 'bg-amber-500/10 text-amber-500',
  }

  return (
    <div className="p-8 space-y-10 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Usage analytics, alerts, and connector management across all workspaces.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Workspaces', value: wsStats.length, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total users', value: (allMemberships ?? []).length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Active connections', value: (allConnections ?? []).length, icon: Plug, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'API calls (month)', value: totalCalls.toLocaleString(), icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <div className={`h-7 w-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{s.value}</p>
            </div>
          )
        })}
      </div>

      {highUsage.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold">High-usage workspaces</h2>
            <span className="text-xs text-muted-foreground">&gt; {HIGH_THRESHOLD} calls this month</span>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 divide-y divide-border/50">
            {highUsage.map(ws => (
              <div key={ws.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{ws.members} members · {ws.connections} connections</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-400">{ws.callsThisMonth.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">API calls</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierColors[ws.tier] ?? 'bg-muted text-muted-foreground'}`}>
                  {ws.tier}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {noUsage.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Connected but inactive this month</h2>
          </div>
          <div className="rounded-xl border bg-card divide-y divide-border/50">
            {noUsage.map(ws => (
              <div key={ws.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{ws.members} members · {ws.connections} connections</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierColors[ws.tier] ?? 'bg-muted text-muted-foreground'}`}>{ws.tier}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">All workspaces</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr,80px,80px,100px,80px] gap-x-4 px-5 py-2.5 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Workspace</span><span className="text-right">Members</span><span className="text-right">APIs</span><span className="text-right">Calls (mo)</span><span className="text-right">Tier</span>
          </div>
          <div className="divide-y divide-border/50">
            {wsStats.map(ws => (
              <div key={ws.id} className="grid grid-cols-[1fr,80px,80px,100px,80px] gap-x-4 px-5 py-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                </div>
                <p className="text-sm text-right">{ws.members}</p>
                <p className="text-sm text-right">{ws.connections}</p>
                <p className={`text-sm text-right font-medium ${ws.callsThisMonth > HIGH_THRESHOLD ? 'text-amber-400' : ''}`}>{ws.callsThisMonth.toLocaleString()}</p>
                <div className="flex justify-end">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierColors[ws.tier] ?? 'bg-muted text-muted-foreground'}`}>{ws.tier}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Connector management</h2>
          <span className="text-xs text-muted-foreground">{managedConnectors.filter(c => !c.disabled).length} active · {managedConnectors.filter(c => c.disabled).length} disabled</span>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr,120px,80px] gap-x-4 px-5 py-2.5 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Connector</span><span>Category</span><span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-border/50">
            {managedConnectors.map(c => (
              <div key={c.slug} className="grid grid-cols-[1fr,120px,80px] gap-x-4 px-5 py-2.5 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  {c.disabled && c.disabled_reason && <p className="text-[11px] text-muted-foreground truncate">{c.disabled_reason}</p>}
                </div>
                <p className="text-xs text-muted-foreground">{c.category}</p>
                <div className="flex justify-end"><ConnectorToggle slug={c.slug} name={c.name} disabled={c.disabled} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {unconnected.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Workspaces without connections ({unconnected.length})</h2>
          <div className="rounded-xl border bg-muted/5 divide-y divide-border/50">
            {unconnected.map(ws => (
              <div key={ws.id} className="flex items-center gap-4 px-5 py-2.5">
                <p className="text-sm flex-1 text-muted-foreground">{ws.name}</p>
                <p className="text-xs text-muted-foreground">{ws.members} member{ws.members !== 1 ? 's' : ''}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierColors[ws.tier] ?? 'bg-muted text-muted-foreground'}`}>{ws.tier}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

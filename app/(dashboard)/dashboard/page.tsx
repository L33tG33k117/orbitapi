import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Plug, Zap, Activity, CheckCircle, XCircle, Clock, ChevronRight, Sparkles } from 'lucide-react'
import { GetStartedChecklist } from '@/components/get-started-checklist'
import { OrbitVisual } from '@/components/orbit-visual'

const RISK_COLORS: Record<string, string> = {
  read: 'bg-blue-500/10 text-blue-400',
  write: 'bg-amber-500/10 text-amber-400',
  destructive: 'bg-red-500/10 text-red-400',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle,
  failed: XCircle,
  running: Clock,
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  running: 'text-amber-400',
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  const wsId = membership?.workspace_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceName = (membership?.workspace as any)?.name ?? 'Your workspace'
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? ''

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { count: connectionCount },
    { count: actionsToday },
    { count: enabledSkills },
    { count: callsMonth },
    { data: recentRuns },
    { data: recentAudit },
    { count: skillsCount },
    { count: groupsCount },
    { count: conversationsCount },
    { count: skillRunsCount },
    { data: orbitConnectionsData },
  ] = await Promise.all([
    supabase.from('connections').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId ?? ''),
    admin.from('audit_log').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId ?? '').gte('created_at', `${today}T00:00:00Z`),
    admin.from('skills').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId ?? '').eq('enabled', true),
    admin.from('audit_log').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId ?? '').gte('created_at', monthStart),
    admin.from('skill_runs').select('id, status, mode, started_at, skills(name)')
      .eq('workspace_id', wsId ?? '').order('started_at', { ascending: false }).limit(5),
    admin.from('audit_log').select('id, action_slug, risk, result_status, created_at, connections(label)')
      .eq('workspace_id', wsId ?? '').order('created_at', { ascending: false }).limit(5),
    admin.from('skills').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId ?? ''),
    admin.from('groups').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId ?? ''),
    admin.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId ?? ''),
    admin.from('skill_runs').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId ?? ''),
    // Feeds the orbital visual in the hero — each connection is a satellite.
    supabase.from('connections').select('id, label, status')
      .eq('workspace_id', wsId ?? '').neq('status', 'trashed')
      .order('created_at').limit(20),
  ])

  // Drives the Get Started checklist — each flag reflects real workspace state.
  const checklist = {
    connected: (connectionCount ?? 0) > 0,
    askedAssistant: (conversationsCount ?? 0) > 0,
    savedSkill: (skillsCount ?? 0) > 0,
    grouped: (groupsCount ?? 0) > 0,
    automated: (skillRunsCount ?? 0) > 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runs = (recentRuns ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audit = (recentAudit ?? []) as any[]
  const orbitConnections = (orbitConnectionsData ?? []) as { id: string; label: string; status: string }[]
  const isEmpty = (connectionCount ?? 0) === 0
  const needsAttention = orbitConnections.filter(c => /error|fail|expired|invalid|revoked/i.test(c.status)).length

  const stats = [
    { label: 'Connected APIs', value: connectionCount ?? 0, href: '/connectors' },
    { label: 'Actions today', value: actionsToday ?? 0, href: '/audit' },
    { label: 'Active skills', value: enabledSkills ?? 0, href: '/skills' },
    { label: 'Calls this month', value: (callsMonth ?? 0).toLocaleString(), href: '/usage' },
  ]

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl">
      {/* Mission control hero — deep space in both themes, with the workspace's
          live connections rendered as an orbital system. */}
      <section className="deep-space-panel relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
          <div className="flex-1 min-w-0 space-y-6 w-full">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{workspaceName}</p>
              <h1 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-white">
                {firstName ? <>Welcome back, <span className="text-gradient">{firstName}</span></> : 'Mission control'}
              </h1>
              <p className="mt-2 text-sm text-white/55 max-w-md">
                {isEmpty
                  ? 'Your orbit is empty — connect your first app and watch it come alive.'
                  : needsAttention > 0
                    ? `${connectionCount} ${connectionCount === 1 ? 'app' : 'apps'} in orbit · ${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`
                    : `${connectionCount} ${connectionCount === 1 ? 'app' : 'apps'} in orbit · all systems nominal`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/chat"
                data-tour="dash-assistant"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] text-white text-sm font-medium transition-all hover:opacity-95 orbit-glow"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Orbit Assistant
              </Link>
              {isEmpty ? (
                <Link
                  href="/welcome"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-white/80 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
                >
                  1-minute guided setup
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  href="/connectors"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-white/80 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Plug className="h-3.5 w-3.5" />
                  Add a connector
                </Link>
              )}
            </div>

            {/* Live stats — each cell links to its detail page */}
            <div data-tour="dash-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-white/10 bg-white/10">
              {stats.map(s => (
                <Link key={s.label} href={s.href} className="group block bg-[oklch(0.14_0.026_276)]/95 px-4 py-3 hover:bg-[oklch(0.19_0.03_276)] transition-colors">
                  <p className="text-[11px] font-medium text-white/45 group-hover:text-white/60 transition-colors">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums font-heading">{s.value}</p>
                </Link>
              ))}
            </div>
          </div>

          <OrbitVisual connections={orbitConnections} />
        </div>
      </section>

      {/* Get started checklist — tracked from real state, dismissible, auto-hides when complete */}
      <GetStartedChecklist state={checklist} />

      {/* Activity panels */}
      {!isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent skill runs */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <h2 className="font-semibold text-sm">Skill runs</h2>
              </div>
              <Link href="/skills" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/40">
              {runs.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No skill runs yet.</p>
                  <Link href="/skills" className="text-xs text-primary hover:text-primary/80 transition-colors mt-1 inline-block">Create a skill</Link>
                </div>
              ) : (
                runs.map(r => {
                  const StatusIcon = STATUS_ICONS[r.status] ?? Clock
                  return (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                      <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLORS[r.status] ?? 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.skills?.name ?? 'Unknown skill'}</p>
                        <p className={`text-[11px] ${STATUS_COLORS[r.status] ?? 'text-muted-foreground'}`}>
                          {r.status} · {r.mode === 'dry_run' ? 'dry run' : 'live'}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(r.started_at)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Recent API actions */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-amber-400" />
                <h2 className="font-semibold text-sm">Recent actions</h2>
              </div>
              <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/40">
              {audit.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No actions yet.</p>
                  <Link href="/chat" className="text-xs text-primary hover:text-primary/80 transition-colors mt-1 inline-block">Try Orbit Assistant</Link>
                </div>
              ) : (
                audit.map(a => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${RISK_COLORS[a.risk] ?? 'bg-muted text-muted-foreground'}`}>
                      {a.risk}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-foreground/80 truncate">{a.action_slug}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.connections?.label ?? ''}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(a.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/connectors"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            API Connectors
          </Link>
          <Link
            href="/usage"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            Usage
          </Link>
          <Link
            href="/skills"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            Skills
          </Link>
        </div>
      )}
    </div>
  )
}

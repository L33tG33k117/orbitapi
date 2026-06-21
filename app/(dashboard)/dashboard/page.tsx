import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Plug, Zap, Activity, CheckCircle, XCircle, Clock, ChevronRight, Sparkles } from 'lucide-react'
import { GetStartedChecklist } from '@/components/get-started-checklist'

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
  const isEmpty = (connectionCount ?? 0) === 0

  const stats = [
    {
      label: 'Connected APIs',
      value: connectionCount ?? 0,
      icon: Plug,
      href: '/connectors',
      linkLabel: 'Manage',
      accent: 'from-[oklch(0.46_0.19_264)] to-[oklch(0.6_0.22_264)]',
      iconColor: 'text-[oklch(0.7_0.2_264)]',
      iconBg: 'bg-[oklch(0.46_0.19_264)]/10',
    },
    {
      label: 'Actions today',
      value: actionsToday ?? 0,
      icon: Activity,
      href: '/audit',
      linkLabel: 'View log',
      accent: 'from-amber-500 to-orange-500',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
    },
    {
      label: 'Active skills',
      value: enabledSkills ?? 0,
      icon: Zap,
      href: '/skills',
      linkLabel: 'Manage',
      accent: 'from-emerald-500 to-green-400',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    {
      label: 'Calls this month',
      value: (callsMonth ?? 0).toLocaleString(),
      icon: Activity,
      href: '/usage',
      linkLabel: 'View usage',
      accent: 'from-violet-500 to-purple-400',
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {firstName ? <>Welcome back, <span className="text-gradient">{firstName}</span></> : 'Overview'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{workspaceName}</p>
        </div>
        <Link
          href="/chat"
          data-tour="dash-assistant"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] text-white text-sm font-medium transition-all hover:opacity-95 orbit-glow"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Orbit Assistant
        </Link>
      </div>

      {/* Brand-new workspace → offer the guided 3-step setup */}
      {isEmpty && (
        <Link
          href="/welcome"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/[0.08] to-primary/[0.02] p-4 hover:from-primary/[0.12] transition-colors"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">New here? Take the 1-minute guided setup</p>
            <p className="text-xs text-muted-foreground">Connect a demo tool, create a skill, and run it — no API keys needed.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
        </Link>
      )}

      {/* Stat cards */}
      <div data-tour="dash-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border bg-card overflow-hidden group hover:shadow-md transition-all duration-200 card-lift">
              <div className={`h-0.5 w-full bg-gradient-to-r ${s.accent}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <div className={`h-7 w-7 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-3.5 w-3.5 ${s.iconColor}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                <Link
                  href={s.href}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors group-hover:text-foreground/70"
                >
                  {s.linkLabel}
                  <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Get started checklist — tracked from real state, dismissible, auto-hides when complete */}
      <GetStartedChecklist state={checklist} />

      {/* Activity panels */}
      {!isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent skill runs */}
          <div className="rounded-xl border bg-card overflow-hidden">
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
          <div className="rounded-xl border bg-card overflow-hidden">
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

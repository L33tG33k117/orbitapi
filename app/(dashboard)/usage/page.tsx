import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsageClient } from './usage-client'
import type { UsageData } from './usage-client'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role, workspace:workspaces(name)')
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()
  const wsId = membership.workspace_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceName = (membership.workspace as any)?.name ?? 'Your workspace'

  // Resolve date range from searchParams or default to current month
  const sp = await searchParams
  const now = new Date()
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const defaultTo = toDateStr(now)
  const from = sp.from ?? defaultFrom
  const to = sp.to ?? defaultTo
  const fromISO = `${from}T00:00:00.000Z`
  const toISO = `${to}T23:59:59.999Z`

  const [
    { data: auditRange },
    { data: skillRunsRange },
    { count: totalConnections },
  ] = await Promise.all([
    admin.from('audit_log')
      .select('action_slug, risk, result_status, created_at, connection:connections(label, connector:connectors(slug, name))')
      .eq('workspace_id', wsId)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin.from('skill_runs')
      .select('status, mode, started_at')
      .eq('workspace_id', wsId)
      .gte('started_at', fromISO)
      .lte('started_at', toISO),
    supabase.from('connections').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId),
  ])

  // By risk
  const byRisk: Record<string, number> = { read: 0, write: 0, destructive: 0 }
  for (const row of auditRange ?? []) byRisk[row.risk] = (byRisk[row.risk] ?? 0) + 1

  // By connector
  const connectorMap: Record<string, { name: string; calls: number; errors: number }> = {}
  for (const row of auditRange ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = row.connection as any
    const slug = conn?.connector?.slug ?? 'unknown'
    const name = conn?.connector?.name ?? slug
    if (!connectorMap[slug]) connectorMap[slug] = { name, calls: 0, errors: 0 }
    connectorMap[slug].calls++
    if (row.result_status === 'error') connectorMap[slug].errors++
  }
  const topConnectors = Object.entries(connectorMap)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 8)
    .map(([slug, d]) => ({ slug, name: d.name, calls: d.calls, errors: d.errors }))

  // Skill stats
  const skillCompleted = (skillRunsRange ?? []).filter(r => r.status === 'completed').length
  const skillFailed = (skillRunsRange ?? []).filter(r => r.status === 'failed').length
  const skillTotal = (skillRunsRange ?? []).length

  // Daily breakdown across the entire range (up to 60 days)
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')
  const dayDiff = Math.min(Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)), 59)

  const dayMap: Record<string, { reads: number; writes: number; destructive: number }> = {}
  for (let i = 0; i <= dayDiff; i++) {
    const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dayMap[key] = { reads: 0, writes: 0, destructive: 0 }
  }
  for (const row of auditRange ?? []) {
    const d = new Date(row.created_at)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (dayMap[key]) {
      if (row.risk === 'read') dayMap[key].reads++
      else if (row.risk === 'write') dayMap[key].writes++
      else dayMap[key].destructive++
    }
  }
  const dailyData = Object.entries(dayMap).map(([label, v]) => ({ label, ...v }))
  const maxDaily = Math.max(...dailyData.map(d => d.reads + d.writes + d.destructive), 1)
  const totalCalls = (auditRange ?? []).length
  const errorCalls = (auditRange ?? []).filter(r => r.result_status === 'error').length

  const data: UsageData = {
    totalCalls,
    errorCalls,
    skillTotal,
    skillCompleted,
    skillFailed,
    totalConnections: totalConnections ?? 0,
    byRisk,
    topConnectors,
    dailyData,
    maxDaily,
    dateRange: { from, to },
    workspaceName,
  }

  return <UsageClient data={data} />
}

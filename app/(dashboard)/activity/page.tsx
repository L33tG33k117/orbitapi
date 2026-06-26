import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActivityFeed, type ActivityItem } from './activity-feed'

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()
  const wsId = membership.workspace_id

  const [auditRes, skillRes, playbookRes] = await Promise.all([
    // User-driven actions (chat, manual, replays). Skill/playbook actions are
    // shown as their parent run below, so we exclude them here (actor_type !=
    // 'user') to avoid showing the same work twice.
    admin.from('audit_log')
      .select('id, action_slug, risk, result_status, result_summary, response, duration_ms, params, connection_id, replay_of, created_at, connection:connections(label, is_simulated)')
      .eq('workspace_id', wsId).eq('actor_type', 'user')
      .order('created_at', { ascending: false }).limit(200),
    admin.from('skill_runs')
      .select('id, mode, status, triggered_by, prompt, steps, started_at, skill:skills(name)')
      .eq('workspace_id', wsId).order('started_at', { ascending: false }).limit(60),
    admin.from('playbook_runs')
      .select('id, mode, status, triggered_by, summary, prompt, steps, error, started_at, playbook:playbooks(name)')
      .eq('workspace_id', wsId).order('started_at', { ascending: false }).limit(60),
  ])

  const items: ActivityItem[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (auditRes.data ?? []) as any[]) {
    items.push({
      kind: 'action',
      id: r.id,
      title: r.action_slug,
      source: r.replay_of ? 'replay' : 'action',
      at: r.created_at,
      status: r.result_status,
      simulated: !!r.connection?.is_simulated,
      connectionLabel: r.connection?.label ?? null,
      connectionId: r.connection_id,
      actionSlug: r.action_slug,
      risk: r.risk,
      durationMs: r.duration_ms,
      params: r.params,
      response: r.response,
      summary: r.result_summary,
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (skillRes.data ?? []) as any[]) {
    items.push({
      kind: 'automation',
      id: r.id,
      title: r.skill?.name ?? 'Skill',
      source: 'skill',
      at: r.started_at,
      status: r.status,
      mode: r.mode,
      triggeredBy: r.triggered_by,
      summary: r.prompt,
      steps: r.steps ?? [],
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (playbookRes.data ?? []) as any[]) {
    items.push({
      kind: 'automation',
      id: r.id,
      title: r.playbook?.name ?? 'Playbook',
      source: 'playbook',
      at: r.started_at,
      status: r.status,
      mode: r.mode,
      triggeredBy: r.triggered_by,
      summary: r.summary ?? r.prompt,
      error: r.error,
      steps: r.steps ?? [],
    })
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-muted-foreground mt-1">
          Every run and its result in one place — your assistant, manual actions, and automations (real and simulated).
        </p>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center border rounded-lg text-muted-foreground">
          <p className="font-medium">Nothing has run yet.</p>
          <p className="text-sm mt-1">Ask Orbit Assistant something, run an action, or set up an automation — results show up here.</p>
        </div>
      ) : (
        <ActivityFeed items={items} isAdmin={isAdmin} />
      )}
    </div>
  )
}

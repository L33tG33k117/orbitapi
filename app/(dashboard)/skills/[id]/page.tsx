import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability } from '@/lib/entitlements'
import { getAiPower, type Efficiency } from '@/lib/ai-power'
import { getConnector } from '@/connectors'
import { scheduleLabel } from '@/lib/schedules'
import { SkillEditor } from './skill-editor'
import { RunHistory } from './run-history'

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [membershipResult, features] = await Promise.all([
    supabase.from('memberships').select('workspace_id, role').eq('user_id', user!.id).single(),
    getWorkspaceFeatures(),
  ])
  const membership = membershipResult.data
  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: skill } = await admin
    .from('skills')
    .select('*, group:groups(id, name, color, group_connections(connection_id))')
    .eq('id', id)
    .single()

  if (!skill) notFound()
  if (skill.workspace_id !== membership.workspace_id) redirect('/skills')

  // Get groups for the group selector
  const { data: groups } = await admin
    .from('groups')
    .select('id, name, color')
    .eq('workspace_id', membership.workspace_id)
    .order('name')

  // Gather all actions from the group's connections to show the blocked-actions picker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = skill.group as any
  const connectionIds: string[] = group
    ? (group.group_connections ?? []).map((gc: { connection_id: string }) => gc.connection_id)
    : []

  let availableActions: { slug: string; name: string; risk: string; connection: string }[] = []
  if (connectionIds.length > 0) {
    const { data: connections } = await admin
      .from('connections')
      .select('id, label, connector:connectors(slug)')
      .in('id', connectionIds)
      .eq('status', 'active')

    for (const conn of connections ?? []) {
      const manifest = getConnector((conn.connector as unknown as { slug: string }).slug)
      if (!manifest) continue
      for (const action of manifest.actions) {
        availableActions.push({
          slug: action.slug,
          name: action.name,
          risk: action.risk,
          connection: conn.label,
        })
      }
    }
  }

  // All active connections (with group membership) for the Skill Builder panel.
  const { data: allConns } = await admin
    .from('connections')
    .select('id, label, connector:connectors(slug, name), group_connections(group_id)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')
  const builderConnections = (allConns ?? []).map(c => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cn = c.connector as any
    const manifest = getConnector(cn?.slug)
    const actions = manifest?.actions ?? []
    return {
      id: c.id, label: c.label, name: cn?.name ?? cn?.slug ?? 'Connector', slug: cn?.slug ?? '',
      reads: actions.filter(a => a.risk === 'read').length,
      writes: actions.filter(a => a.risk !== 'read').length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupIds: ((c as any).group_connections ?? []).map((gc: { group_id: string }) => gc.group_id),
    }
  })

  // Fetch recent runs
  const { data: runs } = await admin
    .from('skill_runs')
    .select('id, mode, status, triggered_by, started_at, completed_at, steps, prompt')
    .eq('skill_id', id)
    .order('started_at', { ascending: false })
    .limit(10)

  const isAdmin = membership.role !== 'member'

  // Effective efficiency drives the AI Power estimate shown in the editor.
  const aiPower = await getAiPower(membership.workspace_id)
  const efficiency = ((skill as unknown as { ai_efficiency?: Efficiency }).ai_efficiency ?? aiPower.efficiency) as Efficiency

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <div className="flex items-center gap-4">
        {group && (
          <div className="h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: group.color }} />
        )}
        <div>
          <h1 className="text-2xl font-bold">{skill.name}</h1>
          {group && <p className="text-sm text-muted-foreground">{group.name}</p>}
          {skill.schedule && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ⏰ {skill.autonomy === 'autonomous' ? 'Polls' : 'Runs'} {scheduleLabel(skill.schedule)}
              {!skill.enabled && <span className="ml-1 text-amber-600">(disabled)</span>}
            </p>
          )}
        </div>
      </div>

      <SkillEditor
        skill={{
          id: skill.id,
          name: skill.name,
          description: skill.description ?? '',
          group_id: skill.group_id ?? '',
          persona: skill.persona ?? '',
          blocked_slugs: (skill.blocked_slugs ?? []) as string[],
          autonomy: skill.autonomy as 'supervised' | 'manual' | 'autonomous',
          enabled: skill.enabled,
          schedule: skill.schedule ?? '',
          trigger_prompt: (skill as unknown as { trigger_prompt?: string }).trigger_prompt ?? '',
          webhook_secret: (skill as unknown as { webhook_secret?: string | null }).webhook_secret ?? null,
        }}
        groups={(groups ?? []) as { id: string; name: string; color: string }[]}
        availableActions={availableActions}
        isAdmin={isAdmin}
        webhooksEnabled={features ? hasCapability(features.tier, features.flags, 'webhooks') : true}
        automationEnabled={features ? hasCapability(features.tier, features.flags, 'skill_automation') : true}
        efficiency={efficiency}
        connections={builderConnections}
      />

      <section className="space-y-3 max-w-3xl">
        <h2 className="text-lg font-semibold">Run history</h2>
        <RunHistory
          skillId={id}
          initialRuns={(runs ?? []) as Parameters<typeof RunHistory>[0]['initialRuns']}
          isAdmin={isAdmin}
          autonomy={skill.autonomy as 'supervised' | 'manual' | 'autonomous'}
          runnable={!!(skill.persona && skill.persona.trim())}
        />
      </section>
    </div>
  )
}

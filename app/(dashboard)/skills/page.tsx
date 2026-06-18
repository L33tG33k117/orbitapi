import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability, requiredTierFor, skillLimit } from '@/lib/entitlements'
import { FeatureGate } from '@/components/feature-gate'
import { scheduleLabel } from '@/lib/schedules'
import { SKILL_TEMPLATES } from '@/lib/skill-templates'
import { CreateSkillForm } from './create-skill-form'
import { SkillTemplates } from './skill-templates'
import { SkillDeleteButton } from './skill-delete-button'
import { SectionIntro } from '@/components/section-intro'

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  const { groupId } = await searchParams
  const [supabase, features] = await Promise.all([createClient(), getWorkspaceFeatures()])
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  if (features && !hasCapability(features.tier, features.flags, 'skills')) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Skills</h1>
        <FeatureGate
          feature="Skills & Automations"
          description="Create AI agents with specific roles that automate workflows across your connected APIs — supervised, manual, or fully autonomous."
          currentTier={features.tier}
          requiredTier={requiredTierFor('skills')}
        />
      </div>
    )
  }

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: skills }, { data: groups }, { data: recentRuns }] = await Promise.all([
    admin
      .from('skills')
      .select('*, group:groups(id, name, color)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at'),
    admin
      .from('groups')
      .select('id, name, color')
      .eq('workspace_id', membership.workspace_id)
      .order('name'),
    admin
      .from('skill_runs')
      .select('skill_id, status')
      .eq('workspace_id', membership.workspace_id)
      .gte('started_at', sevenDaysAgo)
      .limit(500),
  ])

  const healthMap: Record<string, { ok: number; fail: number }> = {}
  for (const run of recentRuns ?? []) {
    if (!healthMap[run.skill_id]) healthMap[run.skill_id] = { ok: 0, fail: 0 }
    if (run.status === 'completed') healthMap[run.skill_id].ok++
    else if (run.status === 'failed') healthMap[run.skill_id].fail++
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Skills</h1>
        <p className="text-muted-foreground mt-1">
          AI agents with a specific role. Each skill uses a group&apos;s connections and can run autonomously or in supervised mode.
        </p>
      </div>

      <SectionIntro id="skills" />

      {isAdmin && features && !hasCapability(features.tier, features.flags, 'skill_automation') && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Your plan includes <span className="font-medium text-foreground">{Number.isFinite(skillLimit(features.tier)) ? skillLimit(features.tier) : 'unlimited'} skill</span>, run manually.
            Upgrade to add more skills and run them on a schedule or fully autonomously.
          </p>
          <Link href="/upgrade" className="text-sm font-medium text-primary hover:underline shrink-0">Upgrade →</Link>
        </div>
      )}

      {isAdmin && (
        <CreateSkillForm
          groups={(groups ?? []) as { id: string; name: string; color: string }[]}
          defaultGroupId={groupId}
        />
      )}

      {(skills ?? []).length === 0 && isAdmin && (
        <SkillTemplates
          templates={SKILL_TEMPLATES}
          groups={(groups ?? []) as { id: string; name: string; color: string }[]}
        />
      )}

      <div className="space-y-2">
        {(skills ?? []).length === 0 && (
          <div className="py-10 text-center border border-dashed rounded-xl text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">No custom skills yet</p>
            <p className="text-xs">Use a template above or create one from scratch.</p>
          </div>
        )}
        {(skills ?? []).map(s => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = s.group as any
          const health = healthMap[s.id]
          const totalRuns = health ? health.ok + health.fail : 0
          const successRate = totalRuns > 0 ? Math.round(health.ok / totalRuns * 100) : null

          return (
            <div key={s.id} className="relative group">
              <Link
                href={`/skills/${s.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all pr-12"
              >
                <div
                  className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: g?.color ?? '#6366f1' }}
                >
                  {s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {g ? g.name : 'No group'}
                    {s.schedule ? ` · ${s.autonomy === 'autonomous' ? 'polls' : 'runs'} ${scheduleLabel(s.schedule)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  {successRate !== null && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      successRate >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                      successRate >= 70 ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {successRate}% · {totalRuns}r
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                    s.autonomy === 'autonomous' ? 'bg-primary/10 text-primary' :
                    s.autonomy === 'manual' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {s.autonomy}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                    s.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    {s.enabled ? 'on' : 'off'}
                  </span>
                </div>
              </Link>
              {isAdmin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SkillDeleteButton skillId={s.id} skillName={s.name} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

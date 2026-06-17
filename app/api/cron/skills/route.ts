import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSkill } from '@/lib/skill-runner'
import { isDue } from '@/lib/schedules'
import { tierMinPollHours, hasAiPower } from '@/lib/ai-power'

// Allow up to 5 minutes for parallel skill runs
export const maxDuration = 300

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron (or internal dev call)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const admin = createAdminClient()

  // Load all enabled skills that have a schedule set
  const { data: skills } = await admin
    .from('skills')
    .select('id, workspace_id, schedule, autonomy, name')
    .eq('enabled', true)
    .not('schedule', 'is', null)

  if (!skills?.length) {
    return NextResponse.json({ triggered: 0, message: 'No scheduled skills' })
  }

  // Map each skill's workspace → tier, to enforce per-tier minimum poll intervals.
  const wsIds = [...new Set(skills.map(s => s.workspace_id))]
  const { data: wsRows } = await admin.from('workspaces').select('id, tier').in('id', wsIds)
  const tierByWs: Record<string, string> = Object.fromEntries((wsRows ?? []).map(w => [w.id, w.tier ?? 'free']))

  const triggered: string[] = []
  const skipped: string[] = []
  const errors: { id: string; error: string }[] = []

  await Promise.all(
    skills.map(async (skill) => {
      if (!skill.schedule || !isDue(skill.schedule, now)) {
        skipped.push(skill.id)
        return
      }

      // Per-tier minimum interval: a single autonomous skill can't poll faster
      // than its plan allows (Starter = 6h), protecting the AI Power pool.
      const minHours = tierMinPollHours(tierByWs[skill.workspace_id])
      const windowMs = Math.max(30 * 60 * 1000, minHours * 60 * 60 * 1000)
      const dedupeWindow = new Date(now.getTime() - windowMs).toISOString()

      const { count } = await admin
        .from('skill_runs')
        .select('*', { count: 'exact', head: true })
        .eq('skill_id', skill.id)
        .eq('triggered_by', 'schedule')
        .gte('started_at', dedupeWindow)

      if (count && count > 0) {
        skipped.push(skill.id)
        return
      }

      // Skip silently if the workspace is out of AI Power.
      if (!(await hasAiPower(skill.workspace_id))) {
        skipped.push(skill.id)
        return
      }

      // Supervised skills always dry-run on schedule (safe); manual/autonomous run live
      const mode = skill.autonomy === 'supervised' ? 'dry_run' : 'live'

      try {
        await runSkill({
          skillId: skill.id,
          workspaceId: skill.workspace_id,
          mode,
          triggeredBy: 'schedule',
        })
        triggered.push(skill.id)
      } catch (err) {
        errors.push({ id: skill.id, error: String(err) })
        console.error(`[cron] skill ${skill.id} (${skill.name}) failed:`, err)
      }
    })
  )

  return NextResponse.json({
    triggered: triggered.length,
    skipped: skipped.length,
    errors: errors.length,
    triggeredIds: triggered,
    errorDetails: errors,
    runAt: now.toISOString(),
  })
}

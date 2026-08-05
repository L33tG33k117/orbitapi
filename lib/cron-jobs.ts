import { createAdminClient } from '@/lib/supabase/admin'
import { runSkill } from '@/lib/skill-runner'
import { runPlaybook, resumePlaybookRun } from '@/lib/playbook-runner'
import { isDue } from '@/lib/schedules'
import { tierMinPollHours, hasAiPower, aiPowerRequired } from '@/lib/ai-power'
import { resolveAiProvider } from '@/lib/ai-provider'
import { isSelfHost } from '@/lib/edition'

// ============================================================
// Scheduled work, callable from anywhere
// ============================================================
// The bodies used to live inside the /api/cron/* route handlers, which meant
// the only way to run them was an HTTP request. That works on Vercel, where
// Cron calls the routes — but the self-hosted package has no Vercel Cron, and
// an in-process scheduler shouldn't have to make an HTTP call to its own
// server (which would need a URL, a secret, and a listening port to exist
// before the scheduler starts).
//
// So the logic lives here and BOTH callers use it: the routes on cloud, and
// the in-process node-cron scheduler on self-host.
// ============================================================

/** Do not re-run a schedule more often than this, whatever the plan says. */
const MIN_DEDUPE_WINDOW_MS = 30 * 60 * 1000

/**
 * Would this run be blocked for lack of AI Power?
 *
 * Self-hosted customers running their own model aren't metered, so a scheduled
 * skill must not be silently skipped because a credit counter — which nothing
 * on that instance ever tops up — reads zero.
 */
async function outOfPower(workspaceId: string): Promise<boolean> {
  const provider = await resolveAiProvider(workspaceId)
  if (!aiPowerRequired(provider)) return false
  return !(await hasAiPower(workspaceId))
}

export interface CronResult {
  triggered: number
  skipped: number
  errors: number
  resumed?: number
  triggeredIds?: string[]
  errorDetails?: { id: string; error: string }[]
  runAt: string
}

// ------------------------------------------------------------
// Scheduled skills
// ------------------------------------------------------------

export async function runDueSkills(now: Date = new Date()): Promise<CronResult> {
  const admin = createAdminClient()

  const { data: skills } = await admin
    .from('skills')
    .select('id, workspace_id, schedule, autonomy, name')
    .eq('enabled', true)
    .not('schedule', 'is', null)

  if (!skills?.length) {
    return { triggered: 0, skipped: 0, errors: 0, runAt: now.toISOString() }
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
      const windowMs = Math.max(MIN_DEDUPE_WINDOW_MS, minHours * 60 * 60 * 1000)
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

      if (await outOfPower(skill.workspace_id)) {
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

  return {
    triggered: triggered.length,
    skipped: skipped.length,
    errors: errors.length,
    triggeredIds: triggered,
    errorDetails: errors,
    runAt: now.toISOString(),
  }
}

// ------------------------------------------------------------
// Scheduled playbooks (+ resuming timer-parked runs)
// ------------------------------------------------------------

export async function runDuePlaybooks(now: Date = new Date()): Promise<CronResult> {
  const admin = createAdminClient()

  // ---- 1. Resume timer-parked runs whose wait has elapsed (async substrate) ----
  const { data: parked } = await admin
    .from('playbook_runs')
    .select('id')
    .eq('status', 'waiting')
    .not('resume_at', 'is', null)
    .lte('resume_at', now.toISOString())

  const resumed: string[] = []
  const resumeErrors: { id: string; error: string }[] = []
  await Promise.all(
    (parked ?? []).map(async (run) => {
      try {
        await resumePlaybookRun({ runId: run.id })
        resumed.push(run.id)
      } catch (err) {
        resumeErrors.push({ id: run.id, error: String(err) })
        console.error(`[cron] playbook run ${run.id} resume failed:`, err)
      }
    })
  )

  // ---- 2. Trigger scheduled playbooks that are due ----
  const { data: playbooks } = await admin
    .from('playbooks')
    .select('id, workspace_id, schedule, name')
    .eq('enabled', true)
    .eq('trigger_type', 'schedule')
    .not('schedule', 'is', null)

  const wsIds = [...new Set((playbooks ?? []).map(p => p.workspace_id))]
  const { data: wsRows } = wsIds.length
    ? await admin.from('workspaces').select('id, tier').in('id', wsIds)
    : { data: [] }
  const tierByWs: Record<string, string> = Object.fromEntries((wsRows ?? []).map(w => [w.id, w.tier ?? 'free']))

  const triggered: string[] = []
  const skipped: string[] = []
  const triggerErrors: { id: string; error: string }[] = []

  await Promise.all(
    (playbooks ?? []).map(async (pb) => {
      if (!pb.schedule || !isDue(pb.schedule, now)) {
        skipped.push(pb.id)
        return
      }
      // Per-tier minimum interval protects the AI Power pool from frequent polling.
      const minHours = tierMinPollHours(tierByWs[pb.workspace_id])
      const windowMs = Math.max(MIN_DEDUPE_WINDOW_MS, minHours * 60 * 60 * 1000)
      const dedupeWindow = new Date(now.getTime() - windowMs).toISOString()
      const { count } = await admin
        .from('playbook_runs')
        .select('*', { count: 'exact', head: true })
        .eq('playbook_id', pb.id)
        .eq('triggered_by', 'schedule')
        .gte('started_at', dedupeWindow)
      if (count && count > 0) {
        skipped.push(pb.id)
        return
      }
      if (await outOfPower(pb.workspace_id)) {
        skipped.push(pb.id)
        return
      }
      try {
        await runPlaybook({
          playbookId: pb.id,
          workspaceId: pb.workspace_id,
          mode: 'live',
          triggeredBy: 'schedule',
        })
        triggered.push(pb.id)
      } catch (err) {
        triggerErrors.push({ id: pb.id, error: String(err) })
        console.error(`[cron] playbook ${pb.id} (${pb.name}) failed:`, err)
      }
    })
  )

  return {
    resumed: resumed.length,
    triggered: triggered.length,
    skipped: skipped.length,
    errors: resumeErrors.length + triggerErrors.length,
    errorDetails: [...resumeErrors, ...triggerErrors],
    runAt: now.toISOString(),
  }
}

// ------------------------------------------------------------
// Shared auth for the HTTP entry points
// ------------------------------------------------------------

/**
 * Is this request genuinely from our scheduler?
 *
 * Previously an UNSET `CRON_SECRET` meant "skip the check entirely", so a
 * misconfigured cloud deployment silently exposed both cron endpoints to
 * anyone who knew the path — each of which can trigger real, billable,
 * write-capable automation. That fails CLOSED now.
 *
 * Self-host is the one place an unset secret is allowed: those instances run
 * the scheduler in-process and typically never expose the routes at all.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (isSelfHost()) return true
    // Loud, because the symptom otherwise is "my scheduled skills stopped
    // running" with a bare 401 and nothing to connect it to.
    console.error(
      '[cron] CRON_SECRET is not set — refusing to run scheduled work. ' +
      'Set CRON_SECRET in the deployment environment; Vercel Cron sends it as ' +
      'an Authorization: Bearer header.',
    )
    return false
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/** Why a cron request was rejected, in a form that's useful in a log. */
export function cronRejectionReason(): string {
  return process.env.CRON_SECRET
    ? 'Unauthorized'
    : 'Scheduled work is disabled because CRON_SECRET is not configured on this deployment.'
}

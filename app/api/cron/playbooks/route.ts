import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPlaybook, resumePlaybookRun } from '@/lib/playbook-runner'
import { isDue } from '@/lib/schedules'
import { tierMinPollHours, hasAiPower } from '@/lib/ai-power'

// Allow up to 5 minutes for parallel playbook work.
export const maxDuration = 300

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron (or internal dev call).
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
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
      const windowMs = Math.max(30 * 60 * 1000, minHours * 60 * 60 * 1000)
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
      if (!(await hasAiPower(pb.workspace_id))) {
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

  return NextResponse.json({
    resumed: resumed.length,
    triggered: triggered.length,
    skipped: skipped.length,
    errors: resumeErrors.length + triggerErrors.length,
    errorDetails: [...resumeErrors, ...triggerErrors],
    runAt: now.toISOString(),
  })
}

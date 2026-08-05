import cron from 'node-cron'
import { runDuePlaybooks, runDueSkills } from '@/lib/cron-jobs'

// ============================================================
// In-process scheduler (self-hosted only)
// ============================================================
// On cloud, Vercel Cron calls /api/cron/* on a schedule. A self-hosted box has
// no such thing, so the app runs its own timer and calls the same functions
// the routes call.
//
// It runs HOURLY rather than daily. That isn't a bigger ambition than cloud —
// it's the removal of a limitation: Vercel's Hobby plan allows one cron run per
// day, which is why scheduled skills there fire daily regardless of the hour
// they're set to. A customer's own hardware has no such cap, so schedules can
// finally mean what they say. The per-run dedupe window in cron-jobs.ts is what
// stops the hourly tick from running the same skill repeatedly.

let started = false

/** Don't let a slow run stack up behind the next tick. */
let skillsRunning = false
let playbooksRunning = false

async function tickSkills() {
  if (skillsRunning) {
    console.warn('[scheduler] previous skills run still in progress — skipping this tick')
    return
  }
  skillsRunning = true
  try {
    const result = await runDueSkills()
    if (result.triggered || result.errors) {
      console.log(`[scheduler] skills: ${result.triggered} triggered, ${result.errors} failed`)
    }
  } catch (err) {
    // A scheduler that dies on one bad run stops all future runs silently,
    // which is the worst possible failure here.
    console.error('[scheduler] skills tick failed:', err)
  } finally {
    skillsRunning = false
  }
}

async function tickPlaybooks() {
  if (playbooksRunning) {
    console.warn('[scheduler] previous playbooks run still in progress — skipping this tick')
    return
  }
  playbooksRunning = true
  try {
    const result = await runDuePlaybooks()
    if (result.triggered || result.resumed || result.errors) {
      console.log(
        `[scheduler] playbooks: ${result.triggered} triggered, ${result.resumed ?? 0} resumed, ${result.errors} failed`,
      )
    }
  } catch (err) {
    console.error('[scheduler] playbooks tick failed:', err)
  } finally {
    playbooksRunning = false
  }
}

export function startScheduler() {
  // Next can call register() more than once in development (hot reload), and
  // two schedulers would double-fire every schedule.
  if (started) return
  started = true

  const tz = process.env.ORBIT_TIMEZONE || 'UTC'

  // Staggered by 15 minutes so both aren't hammering the DB and the model
  // endpoint at the same instant — a local model serves one request at a time.
  cron.schedule('0 * * * *', tickSkills, { timezone: tz })
  cron.schedule('15 * * * *', tickPlaybooks, { timezone: tz })

  console.log(`[scheduler] started (hourly, timezone ${tz})`)
}

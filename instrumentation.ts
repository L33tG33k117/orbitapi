// ============================================================
// Process startup hook
// ============================================================
// Next calls register() once per server process, before it handles requests.
// The self-hosted edition uses it to start the scheduler that Vercel Cron
// provides on cloud.
//
// Cloud is untouched: the whole body is behind an edition check, and the
// scheduler module is only imported when it's actually going to run, so
// node-cron never even loads on Vercel.

export async function register() {
  // Only the Node.js server runtime — not edge, not the browser build.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  if (process.env.ORBIT_EDITION !== 'selfhost') return
  if (process.env.ORBIT_ENABLE_SCHEDULER === 'false') return

  const { startScheduler } = await import('@/lib/scheduler')
  startScheduler()
}

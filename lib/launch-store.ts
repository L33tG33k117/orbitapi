// A tiny global store for "launches" — skills/playbooks/actions the user has
// kicked off. The launch tray (rocket in the top bar) subscribes to this so the
// user can see what's running and jump to the result, from anywhere. No deps:
// a module singleton + useSyncExternalStore.

export type LaunchKind = 'skill' | 'playbook' | 'action'
export type LaunchStatus = 'running' | 'done' | 'failed'

export interface Launch {
  id: string
  name: string
  kind: LaunchKind
  status: LaunchStatus
  startedAt: number
  endedAt?: number
  error?: string
  /** Where "View" takes you — usually /starlab. */
  href: string
}

let launches: Launch[] = []
const EMPTY: Launch[] = []
const listeners = new Set<() => void>()

function emit() {
  // New array identity so useSyncExternalStore re-renders.
  launches = [...launches]
  listeners.forEach(l => l())
}

export function subscribeLaunches(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function getLaunches(): Launch[] {
  return launches
}
export function getLaunchesServer(): Launch[] {
  return EMPTY
}

export function clearFinishedLaunches() {
  launches = launches.filter(l => l.status === 'running')
  emit()
}

// Register a launch as running, execute the work, and update it on completion.
// `doRun` returns whether it succeeded (and an optional error message).
export async function trackLaunch(
  meta: { name: string; kind: LaunchKind; href?: string },
  doRun: () => Promise<{ ok: boolean; error?: string }>,
): Promise<{ ok: boolean }> {
  const id = (globalThis.crypto?.randomUUID?.() ?? String(Math.random())) as string
  const entry: Launch = {
    id, name: meta.name, kind: meta.kind, status: 'running',
    startedAt: Date.now(), href: meta.href ?? '/starlab',
  }
  launches = [entry, ...launches].slice(0, 15)
  emit()
  try {
    const r = await doRun()
    launches = launches.map(l => l.id === id
      ? { ...l, status: r.ok ? 'done' : 'failed', endedAt: Date.now(), error: r.ok ? undefined : (r.error ?? 'Failed') }
      : l)
    emit()
    return { ok: r.ok }
  } catch (e) {
    launches = launches.map(l => l.id === id ? { ...l, status: 'failed', endedAt: Date.now(), error: String(e) } : l)
    emit()
    return { ok: false }
  }
}

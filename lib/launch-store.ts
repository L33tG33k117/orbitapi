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

// ---- Finished-launch history --------------------------------------------
// The Starlab orbit strip shows past launches too (click-through to Activity),
// kept for 7 days in localStorage so the graph survives reloads without
// growing forever (beta feedback 2026-07-12).

const HISTORY_KEY = 'orbit_launch_history_v1'
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000
const HISTORY_MAX = 200

let history: Launch[] = EMPTY
let historyLoaded = false

function loadHistoryOnce() {
  if (historyLoaded || typeof window === 'undefined') return
  historyLoaded = true
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const cutoff = Date.now() - HISTORY_MS
    history = raw
      ? (JSON.parse(raw) as Launch[]).filter(l => l.status !== 'running' && (l.endedAt ?? l.startedAt) >= cutoff)
      : []
  } catch {
    history = []
  }
}

function recordHistory(l: Launch) {
  loadHistoryOnce()
  const cutoff = Date.now() - HISTORY_MS
  history = [l, ...history.filter(h => h.id !== l.id && (h.endedAt ?? h.startedAt) >= cutoff)].slice(0, HISTORY_MAX)
  try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* storage full/blocked — history stays in-memory */ }
}

export function getLaunchHistory(): Launch[] {
  loadHistoryOnce()
  return history
}
export function getLaunchHistoryServer(): Launch[] {
  return EMPTY
}

export function clearFinishedLaunches() {
  launches = launches.filter(l => l.status === 'running')
  emit()
}

// Register a launch as running, execute the work, and update it on completion.
// `doRun` returns whether it succeeded (and an optional error message).
// `discard: true` removes the entry entirely — for runs that were refused
// before doing anything (e.g. connections not set up), where the caller shows
// its own guidance and a "failed" rocket would just be noise.
export async function trackLaunch(
  meta: { name: string; kind: LaunchKind; href?: string },
  doRun: () => Promise<{ ok: boolean; error?: string; discard?: boolean }>,
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
    if (r.discard) {
      launches = launches.filter(l => l.id !== id)
      emit()
      return { ok: r.ok }
    }
    const finished: Launch = {
      ...entry, status: r.ok ? 'done' : 'failed', endedAt: Date.now(),
      error: r.ok ? undefined : (r.error ?? 'Failed'),
    }
    launches = launches.map(l => (l.id === id ? finished : l))
    recordHistory(finished)
    emit()
    return { ok: r.ok }
  } catch (e) {
    const finished: Launch = { ...entry, status: 'failed', endedAt: Date.now(), error: String(e) }
    launches = launches.map(l => (l.id === id ? finished : l))
    recordHistory(finished)
    emit()
    return { ok: false }
  }
}

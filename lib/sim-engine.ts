import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { ActionDef, ActionResult } from '@/connectors/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { simulateAction, hasSimulatedData } from '@/lib/simulate-action'
import { CHEAP_MODEL, computeCost, normalizeUsage } from '@/lib/usage-cost'
import { consumeCredits } from '@/lib/ai-power'

// ============================================================
// Simulation engine — the "always answers" sandbox
// ============================================================
// Every simulated app behaves like a fully working API. Instead of a tiny fixed
// table of records, we keep an evolving "world" per connection and let the model
// generate realistic data to satisfy whatever the user asked — filters, search
// terms, ids, date ranges — then persist it so follow-ups stay consistent.
//
// Resolution order for each call:
//   1. Read cache hit (same read + params already answered) -> instant, free.
//   2. Generate with the model, consistent with the current world; persist.
//   3. Any failure -> static seed data (lib/simulate-action.ts) -> never throws.
//
// Persistence is best-effort: if the simulated_world table is missing or a query
// fails, we keep state in process memory for the life of the warm instance. The
// app stays fully functional either way; the DB just adds cross-session memory.

const GEN_MODEL = CHEAP_MODEL // fast + inexpensive; data generation doesn't need a frontier model

type SimState = {
  world: Record<string, unknown>
  cache: Record<string, unknown>
}

// Warm-instance fallback when the DB table isn't available.
const memoryState = new Map<string, SimState>()

function emptyState(): SimState {
  return { world: {}, cache: {} }
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>).sort().map(k => [k, sortValue((v as Record<string, unknown>)[k])])
    )
  }
  return v
}

function cacheKey(actionSlug: string, params: Record<string, unknown>): string {
  return `${actionSlug}:${JSON.stringify(sortValue(params))}`
}

async function loadState(connectionId: string): Promise<SimState> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('simulated_world')
      .select('state')
      .eq('connection_id', connectionId)
      .single()
    if (error) {
      // Row missing is fine (PGRST116); any other error -> fall back to memory.
      if (error.code !== 'PGRST116') return memoryState.get(connectionId) ?? emptyState()
      return emptyState()
    }
    const state = (data?.state ?? {}) as Partial<SimState>
    return { world: state.world ?? {}, cache: state.cache ?? {} }
  } catch {
    return memoryState.get(connectionId) ?? emptyState()
  }
}

async function saveState(connectionId: string, workspaceId: string, state: SimState): Promise<void> {
  memoryState.set(connectionId, state)
  try {
    const admin = createAdminClient()
    await admin
      .from('simulated_world')
      .upsert(
        { connection_id: connectionId, workspace_id: workspaceId, state, updated_at: new Date().toISOString() },
        { onConflict: 'connection_id' }
      )
  } catch {
    // DB unavailable (e.g. table not migrated yet) — memory copy already set.
  }
}

function clampJson(value: unknown, max = 6000): string {
  const s = JSON.stringify(value ?? {})
  return s.length > max ? s.slice(0, max) + '…(truncated)' : s
}

function buildPrompt(opts: {
  connectorName: string
  connectorSlug: string
  action: ActionDef
  params: Record<string, unknown>
  shapeExample: unknown
  world: Record<string, unknown>
}): string {
  const { connectorName, action, params, shapeExample, world } = opts
  const today = new Date().toISOString().split('T')[0]
  const shape = shapeExample != null
    ? `This is the exact JSON shape this action returns — match these field names precisely:\n${clampJson(shapeExample, 2500)}`
    : `No shape example available — infer the realistic JSON shape the real ${connectorName} API returns for this action.`

  return `You simulate the ${connectorName} API for a sandbox. There is no real backend — you invent realistic, internally-consistent data. Today is ${today}.

Action invoked:
- name: ${action.name}
- description: ${action.description}
- type: ${action.risk}
- input schema: ${clampJson(action.inputSchema, 1500)}

Called with these parameters:
${clampJson(params, 1500)}

${shape}

Current sandbox state (entities that already exist — stay consistent, reuse their ids/names/amounts where the query refers to them):
${clampJson(world)}

Rules:
- Return data that FULLY satisfies the parameters: apply any filter, search term, id lookup, status, or date range the caller asked for. Never return an empty result unless the parameters logically force it (e.g. a get-by-id for an id that was explicitly deleted).
- READ actions: if the requested entities aren't in the state yet, invent plausible ones and add them to the world so future calls stay consistent.
- WRITE / DESTRUCTIVE actions: apply the change to the world (create / update / delete the relevant entity) and return the API's normal success response for that change.
- Keep names, companies, people, amounts, and dates realistic and varied. Cap each collection in the world at ~30 items.
- Output ONLY minified JSON, no markdown, no prose:
{"result": <the data this action returns to the caller>, "world": <the full updated sandbox state>}`
}

function parseGenerated(text: string): { result: unknown; world: Record<string, unknown> } | null {
  let s = text.trim()
  // Strip markdown fences if the model added them despite instructions.
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  // Grab the outermost JSON object.
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(s.slice(start, end + 1))
    if (parsed && typeof parsed === 'object' && 'result' in parsed) {
      return {
        result: (parsed as Record<string, unknown>).result,
        world: ((parsed as Record<string, unknown>).world as Record<string, unknown>) ?? {},
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Resolve a simulated action against the connection's persistent world.
 * Always resolves to a successful ActionResult — it never surfaces a real-API
 * style failure, because in a sandbox there is no real API to fail.
 */
export async function resolveSimulatedAction(opts: {
  workspaceId: string
  connectionId: string
  connectorSlug: string
  connectorName: string
  action: ActionDef
  params: Record<string, unknown>
}): Promise<ActionResult> {
  const { workspaceId, connectionId, connectorSlug, connectorName, action, params } = opts
  const isRead = action.risk === 'read'

  const state = await loadState(connectionId)
  const key = cacheKey(action.slug, params)

  // 1. Read cache hit.
  if (isRead && state.cache[key] !== undefined) {
    return { ok: true, data: state.cache[key] }
  }

  // 2. Generate.
  const shapeExample = hasSimulatedData(connectorSlug, action.slug)
    ? simulateAction(connectorSlug, action.slug, params).data
    : null

  try {
    const { text, usage } = await generateText({
      model: anthropic(GEN_MODEL),
      prompt: buildPrompt({ connectorName, connectorSlug, action, params, shapeExample, world: state.world }),
    })

    // Meter generation cost against the workspace (best-effort, non-blocking).
    try {
      const { tokensIn, tokensOut } = normalizeUsage(usage)
      await consumeCredits(workspaceId, computeCost(GEN_MODEL, tokensIn, tokensOut))
    } catch { /* metering must never block a result */ }

    const parsed = parseGenerated(text)
    if (parsed) {
      const next: SimState = {
        world: parsed.world && Object.keys(parsed.world).length ? parsed.world : state.world,
        // A write changes the world, so previously cached reads may be stale — drop them.
        cache: isRead ? { ...state.cache, [key]: parsed.result } : {},
      }
      await saveState(connectionId, workspaceId, next)
      return { ok: true, data: parsed.result }
    }
  } catch {
    // fall through to static seed
  }

  // 3. Static seed fallback — guarantees a sensible, non-error response.
  return simulateAction(connectorSlug, action.slug, params)
}

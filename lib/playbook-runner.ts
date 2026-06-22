import { generateText, dynamicTool, jsonSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { createNotification } from '@/lib/notify'
import { computeCost, normalizeUsage } from '@/lib/usage-cost'
import { getAiPower, consumeCredits, modelFor, OUT_OF_AI_POWER } from '@/lib/ai-power'
import type { ActionDef } from '@/connectors/types'
import { riskAllowed } from '@/lib/connector-access'

// ============================================================
// Foundation A — Playbook execution engine
// ============================================================
// Walks a playbook's step graph, computing a severity score and
// applying the playbook's autonomy policy to every write action:
//   auto     → execute immediately
//   approval → stage a pending_action and PARK the run (resume later)
//   notify   → skip the write, notify a human
//
// Parked runs (approval gates, timer/event waits) carry their state
// in playbook_runs and resume via resumePlaybookRun(). This is the
// same async substrate that #6 (conditional chaining) builds on.
// ============================================================

export type AutonomyMode = 'auto' | 'approval' | 'notify'

type Threshold = { min: number; max: number; mode: AutonomyMode }
type AutonomyPolicy = { thresholds: Threshold[] }

export type PlaybookNode = {
  id: string
  name: string
  type: 'assess' | 'action' | 'condition' | 'approval' | 'notify' | 'wait'
  // action
  connection_id?: string
  connector_slug?: string   // bundle manifests reference a connector; remapped to connection_id at install
  action_slug?: string
  params?: Record<string, unknown>
  // assess
  prompt?: string
  // condition
  expr?: string            // e.g. "state.open_detections > 0"
  on_true?: string         // node id
  on_false?: string        // node id
  // notify
  message?: string
  // wait
  wait_seconds?: number
  wait_event?: string
  // default sequential successor (node id); falls through to next in array
  next?: string
}

export type RunStep = {
  step: number
  node_id: string
  type: PlaybookNode['type']
  tool_name?: string
  params?: Record<string, unknown>
  result?: unknown
  risk?: string
  severity?: number
  autonomy?: AutonomyMode
  status: 'success' | 'error' | 'skipped' | 'blocked' | 'awaiting_approval' | 'parked' | 'note'
  note?: string
  duration_ms?: number
  started_at?: string
}

type Connection = {
  id: string
  label: string
  vault_secret_id: string | null
  allowed_risk_levels: string[] | null
  connector: { slug: string; name: string }
}

type LoadedPlaybook = {
  id: string
  workspace_id: string
  name: string
  persona: string
  definition: { steps: PlaybookNode[] }
  autonomy_policy: AutonomyPolicy
  created_by: string | null
  group: { id: string; group_connections: { connection_id: string }[] } | null
}

// ------------------------------------------------------------
// Public entrypoints
// ------------------------------------------------------------

export async function runPlaybook(opts: {
  playbookId: string
  workspaceId: string
  mode?: 'dry_run' | 'live'
  triggeredBy?: 'manual' | 'schedule' | 'webhook' | 'chat' | 'event'
  prompt?: string
}): Promise<{ runId: string; status: string }> {
  const admin = createAdminClient()
  const playbook = await loadPlaybook(opts.playbookId)
  if (!playbook) throw new Error('Playbook not found')

  // Enforce AI Power on new runs (resumes are exempt — already approved).
  const power = await getAiPower(opts.workspaceId)
  if (power.remaining <= 0) throw new Error(OUT_OF_AI_POWER)

  const { data: run } = await admin
    .from('playbook_runs')
    .insert({
      playbook_id: playbook.id,
      workspace_id: opts.workspaceId,
      triggered_by: opts.triggeredBy ?? 'manual',
      mode: opts.mode ?? 'live',
      status: 'running',
      state: {},
      steps: [],
      prompt: opts.prompt ?? null,
    })
    .select()
    .single()

  if (!run) throw new Error('Could not create playbook run')

  return executeFrom(run.id, 0)
}

// Resume a parked run. Called by the approval-confirm route (approval
// gates) and by the cron (timer waits / external events).
export async function resumePlaybookRun(opts: {
  runId: string
  approved?: boolean          // result of an approval gate
  eventPayload?: Record<string, unknown>
}): Promise<{ runId: string; status: string }> {
  const admin = createAdminClient()
  const { data: run } = await admin
    .from('playbook_runs')
    .select('*')
    .eq('id', opts.runId)
    .single()

  if (!run) throw new Error('Run not found')
  if (run.status !== 'waiting') return { runId: run.id, status: run.status }

  const playbook = await loadPlaybook(run.playbook_id)
  if (!playbook) throw new Error('Playbook not found')

  const steps = playbook.definition.steps ?? []
  const parkedIdx = steps.findIndex(n => n.id === run.current_step)
  if (parkedIdx < 0) {
    await fail(run.id, run.steps, 'Parked node no longer exists in playbook')
    return { runId: run.id, status: 'failed' }
  }

  // Merge any event payload into carried state for downstream steps.
  const state = { ...(run.state ?? {}), ...(opts.eventPayload ?? {}) }

  // If the approval was rejected, record it and stop cleanly.
  if (opts.approved === false) {
    const log = [...(run.steps ?? [])]
    log.push({
      step: log.length + 1,
      node_id: run.current_step,
      type: 'approval',
      status: 'blocked',
      note: 'Approval rejected by reviewer — playbook halted.',
    })
    await complete(run.id, log, state, 'Halted: approval rejected')
    return { runId: run.id, status: 'completed' }
  }

  await admin
    .from('playbook_runs')
    .update({ status: 'running', waiting_on: null, resume_token: null, resume_at: null, state })
    .eq('id', run.id)

  // Resume by re-running the parked node (now cleared to proceed),
  // then continuing through the rest of the graph.
  return executeFrom(run.id, parkedIdx, { approvedNode: run.current_step })
}

// ------------------------------------------------------------
// Core walker
// ------------------------------------------------------------

async function executeFrom(
  runId: string,
  startIndex: number,
  resume?: { approvedNode?: string }
): Promise<{ runId: string; status: string }> {
  const admin = createAdminClient()
  const { data: run } = await admin.from('playbook_runs').select('*').eq('id', runId).single()
  if (!run) throw new Error('Run vanished mid-execution')

  const playbook = await loadPlaybook(run.playbook_id)
  if (!playbook) throw new Error('Playbook not found')

  const connections = await loadConnections(playbook)
  const credCache: Record<string, Record<string, string>> = {}
  const actionIndex = await buildActionIndex(connections, credCache)

  // Resolve the model from the workspace's Efficiency setting.
  const power = await getAiPower(run.workspace_id)
  const chosenModel = modelFor(undefined, power.efficiency)

  const nodes = playbook.definition.steps ?? []
  const log: RunStep[] = [...(run.steps ?? [])]
  let state: Record<string, unknown> = { ...(run.state ?? {}) }
  let severity: number | null = run.severity ?? null
  const mode = run.mode as 'dry_run' | 'live'

  try {
    let idx = startIndex
    while (idx >= 0 && idx < nodes.length) {
      const node = nodes[idx]
      const startedAt = Date.now()

      // ---- assess: AI gathers read-only data and scores severity 0–10
      if (node.type === 'assess') {
        const { severity: sev, summary, findings, usage } = await assess(node, playbook, actionIndex, state, chosenModel)
        severity = sev
        state = { ...state, ...findings, assessment: summary, severity: sev }
        const { tokensIn, tokensOut } = normalizeUsage(usage)
        const stepCost = computeCost(chosenModel, tokensIn, tokensOut)
        log.push({
          step: log.length + 1, node_id: node.id, type: 'assess', severity: sev,
          status: 'success', note: summary, duration_ms: Date.now() - startedAt,
        })
        // Accumulate LLM cost onto the run (#8) — additive so resumes don't reset it.
        await admin.rpc('increment_playbook_run_cost', {
          p_run_id: runId,
          p_tokens_in: tokensIn,
          p_tokens_out: tokensOut,
          p_cost: stepCost,
          p_model: chosenModel,
        }).then(() => {}, () => {}) // best-effort; never fail a run on cost accounting
        await consumeCredits(run.workspace_id, stepCost)
        await persist(runId, log, state, { severity: sev })
        idx = nextIndex(nodes, idx, node.next)
        continue
      }

      // ---- condition: branch on a simple expression over state
      if (node.type === 'condition') {
        const truthy = evalExpr(node.expr ?? 'false', state)
        log.push({
          step: log.length + 1, node_id: node.id, type: 'condition',
          status: 'note', note: `${node.expr} → ${truthy}`, duration_ms: Date.now() - startedAt,
        })
        const target = truthy ? node.on_true : node.on_false
        await persist(runId, log, state)
        idx = target ? indexOfNode(nodes, target) : nextIndex(nodes, idx, node.next)
        continue
      }

      // ---- notify: surface to a human, never writes
      if (node.type === 'notify') {
        await createNotification({
          workspaceId: playbook.workspace_id,
          type: 'info',
          title: `${playbook.name}: ${node.name}`,
          body: interpolate(node.message ?? '', state).slice(0, 400),
          link: `/playbooks/${playbook.id}/runs/${runId}`,
        })
        log.push({
          step: log.length + 1, node_id: node.id, type: 'notify',
          status: 'success', note: 'Notification sent', duration_ms: Date.now() - startedAt,
        })
        await persist(runId, log, state)
        idx = nextIndex(nodes, idx, node.next)
        continue
      }

      // ---- wait: park on a timer or external event (async substrate)
      if (node.type === 'wait') {
        const resumeAt = node.wait_seconds
          ? new Date(Date.now() + node.wait_seconds * 1000).toISOString()
          : null
        log.push({
          step: log.length + 1, node_id: node.id, type: 'wait', status: 'parked',
          note: node.wait_event ? `Waiting for event: ${node.wait_event}` : `Waiting ${node.wait_seconds}s`,
        })
        await park(runId, log, state, node.id, {
          kind: node.wait_event ? 'event' : 'timer',
          event: node.wait_event ?? null,
          until: resumeAt,
        }, resumeAt)
        return { runId, status: 'waiting' }
      }

      // ---- explicit approval gate
      if (node.type === 'approval') {
        const created = await stageApproval(playbook, runId, node, state, severity)
        log.push({
          step: log.length + 1, node_id: node.id, type: 'approval', severity: severity ?? undefined,
          status: 'awaiting_approval', note: `Approval requested (ref ${created})`,
        })
        await park(runId, log, state, node.id, { kind: 'approval', ref: created }, null)
        return { runId, status: 'waiting' }
      }

      // ---- action: execute a connector action, gated by autonomy policy
      if (node.type === 'action') {
        const entry = node.connection_id && node.action_slug
          ? actionIndex[`${node.connection_id}__${node.action_slug}`]
          : undefined
        if (!entry) {
          log.push({
            step: log.length + 1, node_id: node.id, type: 'action', status: 'error',
            note: `Action ${node.action_slug} not available on this playbook's connections`,
          })
          await persist(runId, log, state)
          idx = nextIndex(nodes, idx, node.next)
          continue
        }

        const params = interpolateParams(node.params ?? {}, state)
        const isWrite = entry.action.risk !== 'read'
        const decision = isWrite ? resolveMode(severity, playbook.autonomy_policy) : 'auto'
        const justApproved = resume?.approvedNode === node.id

        // Dry-run never writes.
        if (isWrite && mode === 'dry_run') {
          log.push({
            step: log.length + 1, node_id: node.id, type: 'action', tool_name: entry.action.name,
            params, risk: entry.action.risk, autonomy: decision, status: 'skipped',
            note: `Dry run — would execute on ${entry.connection.label}`, duration_ms: Date.now() - startedAt,
          })
          await persist(runId, log, state)
          idx = nextIndex(nodes, idx, node.next)
          continue
        }

        // Autonomy gate (skipped if this node was just approved on resume).
        if (isWrite && !justApproved) {
          if (decision === 'notify') {
            await createNotification({
              workspaceId: playbook.workspace_id, type: 'info',
              title: `${playbook.name}: action not taken`,
              body: `Severity ${severity ?? '?'} is below the auto/approval threshold — ${entry.action.name} on ${entry.connection.label} was skipped.`,
              link: `/playbooks/${playbook.id}/runs/${runId}`,
            })
            log.push({
              step: log.length + 1, node_id: node.id, type: 'action', tool_name: entry.action.name,
              params, risk: entry.action.risk, severity: severity ?? undefined, autonomy: 'notify',
              status: 'skipped', note: 'Below threshold — notified instead of acting',
              duration_ms: Date.now() - startedAt,
            })
            await persist(runId, log, state)
            idx = nextIndex(nodes, idx, node.next)
            continue
          }
          if (decision === 'approval') {
            const created = await stageApproval(playbook, runId, node, state, severity, entry)
            log.push({
              step: log.length + 1, node_id: node.id, type: 'action', tool_name: entry.action.name,
              params, risk: entry.action.risk, severity: severity ?? undefined, autonomy: 'approval',
              status: 'awaiting_approval', note: `Severity ${severity ?? '?'} requires approval (ref ${created})`,
            })
            await park(runId, log, state, node.id, { kind: 'approval', ref: created }, null)
            return { runId, status: 'waiting' }
          }
        }

        // decision === 'auto' (or read, or just-approved): execute.
        const creds = credCache[entry.connection.id]
        const result = await entry.action.execute(creds, params)
        const dur = Date.now() - startedAt

        log.push({
          step: log.length + 1, node_id: node.id, type: 'action', tool_name: entry.action.name,
          params, risk: entry.action.risk, severity: severity ?? undefined,
          autonomy: justApproved ? 'approval' : decision,
          result: result.ok ? result.data : { error: result.error },
          status: result.ok ? 'success' : 'error', duration_ms: dur,
          note: justApproved ? 'Executed after approval' : undefined,
        })

        if (isWrite && result.ok) {
          await admin.from('audit_log').insert({
            workspace_id: playbook.workspace_id,
            actor_type: 'playbook',
            actor_id: playbook.id,
            connection_id: entry.connection.id,
            action_slug: entry.action.slug,
            risk: entry.action.risk,
            params,
            result_status: 'success',
            result_summary: `Playbook run ${runId} (severity ${severity ?? '?'}, ${justApproved ? 'approved' : decision})`,
          })
        }

        // Stash the action result so later steps / conditions can read it.
        state = { ...state, [`${node.id}_result`]: result.ok ? result.data : { error: result.error } }
        await persist(runId, log, state)
        idx = nextIndex(nodes, idx, node.next)
        continue
      }

      // Unknown node type — skip defensively.
      idx = nextIndex(nodes, idx, node.next)
    }

    const summary = summarize(log, mode)
    await complete(runId, log, state, summary)
    await createNotification({
      workspaceId: playbook.workspace_id, type: 'skill_completed',
      title: `${playbook.name} ${mode === 'dry_run' ? 'dry run' : 'run'} completed`,
      body: summary, link: `/playbooks/${playbook.id}/runs/${runId}`,
    })
    return { runId, status: 'completed' }
  } catch (err) {
    await fail(runId, log, String(err))
    await createNotification({
      workspaceId: playbook.workspace_id, type: 'skill_failed',
      title: `${playbook.name} run failed`, body: String(err).slice(0, 200),
      link: `/playbooks/${playbook.id}/runs/${runId}`,
    })
    throw err
  }
}

// ------------------------------------------------------------
// Severity assessment (read-only AI pass)
// ------------------------------------------------------------

async function assess(
  node: PlaybookNode,
  playbook: LoadedPlaybook,
  actionIndex: ActionIndex,
  state: Record<string, unknown>,
  model: string,
): Promise<{ severity: number; summary: string; findings: Record<string, unknown>; usage: unknown }> {
  // Only expose read actions to the assessment pass.
  const tools: Record<string, ReturnType<typeof dynamicTool>> = {}
  for (const key of Object.keys(actionIndex)) {
    const entry = actionIndex[key]
    if (entry.action.risk !== 'read') continue
    tools[key.replaceAll('-', '_')] = dynamicTool({
      description: `[${entry.connection.label}] ${entry.action.description}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: jsonSchema<Record<string, unknown>>(entry.action.inputSchema as any),
      execute: async (params: unknown) =>
        (await entry.action.execute(
          (await creds(entry)), (params ?? {}) as Record<string, unknown>
        )).data ?? {},
    })
  }

  const systemPrompt = `${playbook.persona || 'You are a security operations analyst.'}

You are the ASSESSMENT phase of an automated playbook. Gather current data using the
read-only tools, then judge the situation's SEVERITY on a 0–10 scale where:
  0–5  = informational / low — no automated action warranted
  6–8  = elevated — a human should approve any action
  9–10 = critical — immediate automated response is justified

Current carried state: ${JSON.stringify(state).slice(0, 1500)}

Respond with ONE json object and nothing else:
{"severity": <0-10 number>, "summary": "<one sentence>", "findings": { <key facts downstream steps need> }}`

  const { text, usage } = await generateText({
    model: anthropic(model),
    // Cache the system + tool definitions so input bills ~10%.
    messages: [
      { role: 'system', content: systemPrompt, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
      { role: 'user', content: interpolate(node.prompt ?? 'Assess the current situation.', state) },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
    stopWhen: stepCountIs(10),
  })

  return { ...parseAssessment(text), usage }
}

function parseAssessment(text: string): { severity: number; summary: string; findings: Record<string, unknown> } {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const obj = JSON.parse(match[0])
      const sev = Math.max(0, Math.min(10, Number(obj.severity)))
      return {
        severity: Number.isFinite(sev) ? sev : 0,
        summary: String(obj.summary ?? '').slice(0, 500),
        findings: (obj.findings && typeof obj.findings === 'object') ? obj.findings : {},
      }
    }
  } catch {
    // fall through
  }
  return { severity: 0, summary: text.slice(0, 500), findings: {} }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function resolveMode(severity: number | null, policy: AutonomyPolicy): AutonomyMode {
  const s = severity ?? 0
  for (const t of policy.thresholds ?? []) {
    if (s >= t.min && s <= t.max) return t.mode
  }
  return 'approval' // safe default when no band matches
}

// Next node: explicit `next` id, else the next node in the array.
function nextIndex(nodes: PlaybookNode[], idx: number, next?: string): number {
  if (next) return indexOfNode(nodes, next)
  return idx + 1
}
function indexOfNode(nodes: PlaybookNode[], id: string): number {
  const i = nodes.findIndex(n => n.id === id)
  return i < 0 ? nodes.length : i // unknown target ends the run
}

// Minimal, safe expression evaluator over `state`. Supports comparisons
// and boolean operators against state.<key> and literals — no arbitrary code.
function evalExpr(expr: string, state: Record<string, unknown>): boolean {
  const m = expr.match(/^\s*state\.([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/)
  if (!m) {
    // bare "state.key" → truthiness
    const bare = expr.match(/^\s*state\.([\w.]+)\s*$/)
    if (bare) return Boolean(readPath(state, bare[1]))
    return false
  }
  const [, path, op, rawRhs] = m
  const lhs = readPath(state, path)
  let rhs: unknown = rawRhs.trim()
  if (rhs === 'true') rhs = true
  else if (rhs === 'false') rhs = false
  else if (/^-?\d+(\.\d+)?$/.test(rhs as string)) rhs = Number(rhs)
  else rhs = (rhs as string).replace(/^['"]|['"]$/g, '')

  const ln = Number(lhs), rn = Number(rhs)
  switch (op) {
    case '==': return lhs == rhs // eslint-disable-line eqeqeq
    case '!=': return lhs != rhs // eslint-disable-line eqeqeq
    case '>': return ln > rn
    case '<': return ln < rn
    case '>=': return ln >= rn
    case '<=': return ln <= rn
    default: return false
  }
}

function readPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) =>
    (acc && typeof acc === 'object') ? (acc as Record<string, unknown>)[key] : undefined, obj)
}

// Replace {{state.x}} tokens inside a string.
function interpolate(tpl: string, state: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*state\.([\w.]+)\s*\}\}/g, (_, p) => {
    const v = readPath(state, p)
    return v == null ? '' : String(v)
  })
}

function interpolateParams(params: Record<string, unknown>, state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === 'string' ? interpolate(v, state) : v
  }
  return out
}

function summarize(log: RunStep[], mode: 'dry_run' | 'live'): string {
  const writes = log.filter(s => s.status === 'success' && s.risk && s.risk !== 'read').length
  const reads = log.filter(s => s.status === 'success').length
  const approvals = log.filter(s => s.status === 'awaiting_approval').length
  const skipped = log.filter(s => s.status === 'skipped').length
  if (mode === 'dry_run') return `Dry run: ${skipped} write(s) would execute, ${reads} step(s) completed`
  const parts = [`${writes} write(s) executed`, `${reads} step(s) total`]
  if (approvals) parts.push(`${approvals} awaiting approval`)
  if (skipped) parts.push(`${skipped} skipped`)
  return parts.join(', ')
}

// ------------------------------------------------------------
// Approval staging + persistence
// ------------------------------------------------------------

async function stageApproval(
  playbook: LoadedPlaybook,
  runId: string,
  node: PlaybookNode,
  state: Record<string, unknown>,
  severity: number | null,
  entry?: ActionEntry
): Promise<string> {
  const admin = createAdminClient()
  // Route the approval to the playbook owner; fall back to any workspace admin.
  let approver = playbook.created_by
  if (!approver) {
    const { data: m } = await admin
      .from('memberships')
      .select('user_id')
      .eq('workspace_id', playbook.workspace_id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .single()
    approver = m?.user_id ?? null
  }

  const summary = entry
    ? `Playbook "${playbook.name}" wants to run ${entry.action.name} on ${entry.connection.label} (severity ${severity ?? '?'})`
    : `Playbook "${playbook.name}" is paused at "${node.name}" awaiting approval (severity ${severity ?? '?'})`

  const { data } = await admin
    .from('pending_actions')
    .insert({
      workspace_id: playbook.workspace_id,
      user_id: approver,
      connection_id: entry?.connection.id ?? null,
      action_slug: entry?.action.slug ?? `playbook:${node.id}`,
      params: { ...interpolateParams(node.params ?? {}, state), __playbook_run: runId, __node: node.id },
      summary,
      status: 'pending',
      // approvals on playbooks shouldn't auto-expire as aggressively
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  await createNotification({
    workspaceId: playbook.workspace_id,
    userId: approver ?? undefined,
    type: 'pending_action',
    title: `Approval needed: ${playbook.name}`,
    body: summary,
    link: `/approvals`,
  })

  return data?.id ?? ''
}

async function persist(
  runId: string, steps: RunStep[], state: Record<string, unknown>, extra?: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('playbook_runs')
    .update({ steps, state, updated_at: new Date().toISOString(), ...(extra ?? {}) })
    .eq('id', runId)
}

async function park(
  runId: string, steps: RunStep[], state: Record<string, unknown>,
  nodeId: string, waitingOn: Record<string, unknown>, resumeAt: string | null
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('playbook_runs').update({
    status: 'waiting',
    steps,
    state,
    current_step: nodeId,
    waiting_on: waitingOn,
    resume_token: randomUUID(),
    resume_at: resumeAt,
    updated_at: new Date().toISOString(),
  }).eq('id', runId)
}

async function complete(
  runId: string, steps: RunStep[], state: Record<string, unknown>, summary: string
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('playbook_runs').update({
    status: 'completed', steps, state, summary,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', runId)
}

async function fail(runId: string, steps: RunStep[], error: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('playbook_runs').update({
    status: 'failed', steps, error: error.slice(0, 1000),
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', runId)
}

// ------------------------------------------------------------
// Loading + action index
// ------------------------------------------------------------

type ActionEntry = { action: ActionDef; connection: Connection }
type ActionIndex = Record<string, ActionEntry>

async function loadPlaybook(playbookId: string): Promise<LoadedPlaybook | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('playbooks')
    .select('id, workspace_id, name, persona, definition, autonomy_policy, created_by, group:groups(id, group_connections(connection_id))')
    .eq('id', playbookId)
    .single()
  return (data as unknown as LoadedPlaybook) ?? null
}

async function loadConnections(playbook: LoadedPlaybook): Promise<Connection[]> {
  const ids = playbook.group?.group_connections?.map(gc => gc.connection_id) ?? []
  if (ids.length === 0) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('connections')
    .select('id, label, vault_secret_id, allowed_risk_levels, connector:connectors(slug, name)')
    .in('id', ids)
    .eq('status', 'active')
  return (data ?? []) as unknown as Connection[]
}

async function buildActionIndex(
  connections: Connection[], credCache: Record<string, Record<string, string>>
): Promise<ActionIndex> {
  const index: ActionIndex = {}
  for (const conn of connections) {
    const manifest = getConnector(conn.connector.slug)
    if (!manifest) continue
    credCache[conn.id] = await resolveCredentials(conn)
    for (const action of manifest.actions) {
      // Per-connector access controls: don't expose disabled action classes
      if (!riskAllowed(conn.allowed_risk_levels, action.risk)) continue
      index[`${conn.id}__${action.slug}`] = { action, connection: conn }
    }
  }
  return index
}

// Resolve creds for the assessment tool closures (cache is built per-run).
const _credMemo = new WeakMap<ActionEntry, Record<string, string>>()
async function creds(entry: ActionEntry): Promise<Record<string, string>> {
  const cached = _credMemo.get(entry)
  if (cached) return cached
  const resolved = await resolveCredentials(entry.connection)
  _credMemo.set(entry, resolved)
  return resolved
}

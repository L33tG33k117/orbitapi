import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { resumePlaybookRun } from '@/lib/playbook-runner'
import { explainActionError, type ExplainedError } from '@/lib/action-errors'
import { logServerError } from '@/lib/error-log'
import { isWorkspaceOffline } from '@/lib/offline-mode'

// One place that carries out an approved (or rejected) pending action.
//
// Both the chat confirmation card and the Approvals page used to have their own
// copy of this. They drifted: the Approvals page executed playbook gates
// directly and never resumed the parked run (so the run sat in "waiting"
// forever), and neither caught a connector that THREW instead of returning
// { ok: false } — leaving the row stuck in "confirmed" with no message.

export type PendingOutcome =
  | { ok: true; status: 'executed' | 'resumed' | 'rejected'; data?: unknown; runStatus?: string; message: string }
  | { ok: false; status: 'failed' | 'expired' | 'not_found'; error: string; explained: ExplainedError; httpStatus: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PendingRow = any

const INTERNAL_KEYS = ['__playbook_run', '__node']

export async function resolvePendingAction(opts: {
  pending: PendingRow
  approved: boolean
  actorId: string
  rollbackReasoning?: string
}): Promise<PendingOutcome> {
  const admin = createAdminClient()
  const { pending, approved } = opts
  const connection = pending.connection as {
    id: string; label?: string; workspace_id: string; vault_secret_id: string | null; connector: { slug: string }
  } | null
  const ctx = { connectionId: connection?.id, connectionLabel: connection?.label }
  const params = (pending.params ?? {}) as Record<string, unknown>
  const playbookRunId = params.__playbook_run as string | undefined

  // Offline mode: nothing may execute from the cloud copy of this workspace.
  if (approved && await isWorkspaceOffline(pending.workspace_id)) {
    const explained = {
      kind: 'unavailable' as const,
      title: 'This workspace is in offline mode.',
      hint: 'Actions run on your self-hosted install now. Approve it there, or switch this workspace back to online mode.',
      fixHref: '/settings/downloads#offline-mode', fixLabel: 'Offline mode settings',
    }
    return { ok: false, status: 'failed', error: 'offline_mode', explained, httpStatus: 409 }
  }

  // Only transition rows that are still pending — two tabs clicking at once
  // must not both execute.
  const { data: claimed } = await admin
    .from('pending_actions')
    .update({ status: approved ? 'confirmed' : 'rejected' })
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select('id')
  if (!claimed?.length) {
    const explained = { kind: 'unknown' as const, title: 'This request was already handled.', hint: 'Refresh to see its current status.' }
    return { ok: false, status: 'not_found', error: 'Not found or already resolved', explained, httpStatus: 409 }
  }

  // ── Playbook gate: resume (or halt) the parked run; it executes the node itself.
  if (playbookRunId) {
    try {
      const { status } = await resumePlaybookRun({ runId: playbookRunId, approved })
      if (!approved) return { ok: true, status: 'rejected', runStatus: status, message: 'Rejected. The playbook run was stopped.' }

      const { data: run } = await admin
        .from('playbook_runs').select('steps, error, status').eq('id', playbookRunId).single()
      const nodeId = params.__node as string | undefined
      const steps = (run?.steps ?? []) as { node_id?: string; status?: string; result?: { error?: string } }[]
      const approvedStep = [...steps].reverse().find(s => s.node_id === nodeId && s.status !== 'awaiting_approval')
      const stepError = approvedStep?.status === 'error' ? (approvedStep.result?.error ?? 'Action failed') : null
      const runError = run?.status === 'failed' ? (run.error ?? 'Playbook run failed') : null
      const error = stepError ?? runError
      if (error) {
        await admin.from('pending_actions').update({ status: 'failed' }).eq('id', pending.id)
        return { ok: false, status: 'failed', error, explained: explainActionError(error, ctx), httpStatus: 422 }
      }
      await admin.from('pending_actions').update({ status: 'executed' }).eq('id', pending.id)
      return {
        ok: true, status: 'resumed', runStatus: status,
        message: status === 'waiting' ? 'Approved. The playbook continued and is waiting on its next step.' : 'Approved. The playbook continued.',
      }
    } catch (err) {
      logServerError(err, 'pending-actions', { workspaceId: pending.workspace_id })
      const error = err instanceof Error ? err.message : String(err)
      await admin.from('pending_actions').update({ status: 'failed' }).eq('id', pending.id)
      return { ok: false, status: 'failed', error, explained: explainActionError(error, ctx), httpStatus: 500 }
    }
  }

  if (!approved) return { ok: true, status: 'rejected', message: 'Rejected. Nothing was changed.' }

  // ── Direct action
  const fail = async (error: string, httpStatus = 422): Promise<PendingOutcome> => {
    await admin.from('pending_actions').update({ status: 'failed' }).eq('id', pending.id)
    return { ok: false, status: 'failed', error, explained: explainActionError(error, ctx), httpStatus }
  }

  if (!connection) return fail('The connection for this action no longer exists (not found).', 404)
  const manifest = getConnector(connection.connector.slug)
  if (!manifest) return fail(`Connector ${connection.connector.slug} is not installed (not found).`, 404)
  const action = manifest.actions.find(a => a.slug === pending.action_slug)
  if (!action) return fail(`Action ${pending.action_slug} was not found on this connector.`, 404)

  const cleanParams = Object.fromEntries(Object.entries(params).filter(([k]) => !INTERNAL_KEYS.includes(k)))

  let result: { ok: boolean; data?: unknown; error?: string }
  try {
    const creds = await resolveCredentials(connection)
    result = await action.execute(creds, cleanParams)
  } catch (err) {
    // A connector that throws is treated like one that returned an error.
    logServerError(err, 'pending-actions', { workspaceId: connection.workspace_id })
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await admin.from('pending_actions').update({ status: result.ok ? 'executed' : 'failed' }).eq('id', pending.id)

  const baseSummary = result.ok
    ? JSON.stringify(result.data ?? null).slice(0, 500)
    : (result.error ?? 'Unknown error')
  await admin.from('audit_log').insert({
    workspace_id: connection.workspace_id,
    actor_type: 'user',
    actor_id: opts.actorId,
    connection_id: connection.id,
    action_slug: pending.action_slug,
    risk: action.risk,
    params: cleanParams,
    response: result.ok ? (result.data ?? null) : { error: result.error },
    result_status: result.ok ? 'success' : 'error',
    result_summary: opts.rollbackReasoning
      ? `[Rollback plan: ${opts.rollbackReasoning.slice(0, 200)}] ${baseSummary}`.slice(0, 500)
      : baseSummary,
  })

  if (!result.ok) {
    const error = result.error ?? 'Unknown error'
    return { ok: false, status: 'failed', error, explained: explainActionError(error, ctx), httpStatus: 422 }
  }
  return { ok: true, status: 'executed', data: result.data, message: `${action.name} ran successfully.` }
}

/** JSON body for a route response. Keeps the old `error` / `data` keys. */
export function outcomeBody(o: PendingOutcome) {
  return o.ok
    ? { ok: true, status: o.status, data: o.data ?? (o.runStatus ? { resumed: true, runStatus: o.runStatus } : undefined), message: o.message }
    : { ok: false, status: o.status, error: o.error, explained: o.explained }
}

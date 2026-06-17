import { createAdminClient } from '@/lib/supabase/admin'
import { runSkill } from '@/lib/skill-runner'
import { runPlaybook, resumePlaybookRun } from '@/lib/playbook-runner'

// Shared dispatch logic for inbound webhooks — used by the live receiver
// (/api/hooks/[token]) and the dashboard replay endpoint (#10).

export interface WebhookEndpointRow {
  id: string
  workspace_id: string
  target_type: 'skill' | 'playbook' | 'event'
  target_id: string | null
  event_name: string | null
}

export async function dispatchWebhook(
  endpoint: WebhookEndpointRow,
  payload: Record<string, unknown>
): Promise<string> {
  const admin = createAdminClient()

  if (endpoint.target_type === 'skill' && endpoint.target_id) {
    const runId = await runSkill({
      skillId: endpoint.target_id,
      workspaceId: endpoint.workspace_id,
      mode: 'live',
      prompt: `Triggered by webhook. Payload: ${JSON.stringify(payload).slice(0, 2000)}`,
      triggeredBy: 'webhook',
    })
    return `Ran skill (run ${runId})`
  }

  if (endpoint.target_type === 'playbook' && endpoint.target_id) {
    const { runId, status } = await runPlaybook({
      playbookId: endpoint.target_id,
      workspaceId: endpoint.workspace_id,
      mode: 'live',
      triggeredBy: 'webhook',
      prompt: JSON.stringify(payload).slice(0, 2000),
    })
    return `Started playbook (run ${runId}, ${status})`
  }

  // 'event': resume any playbook runs parked waiting on this event name (#6).
  if (endpoint.target_type === 'event' && endpoint.event_name) {
    const { data: waiting } = await admin
      .from('playbook_runs')
      .select('id')
      .eq('workspace_id', endpoint.workspace_id)
      .eq('status', 'waiting')
      .eq('waiting_on->>kind', 'event')
      .eq('waiting_on->>event', endpoint.event_name)

    let resumed = 0
    for (const run of waiting ?? []) {
      await resumePlaybookRun({ runId: run.id, eventPayload: payload })
      resumed++
    }
    return `Emitted event "${endpoint.event_name}" — resumed ${resumed} run(s)`
  }

  return 'No matching dispatch target'
}

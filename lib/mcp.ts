import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import type { ActionDef } from '@/connectors/types'
import { resolveCredentials } from '@/lib/credentials'
import { resolveSimulatedAction } from '@/lib/sim-engine'
import { riskAllowed } from '@/lib/connector-access'
import { createNotification } from '@/lib/notify'

// Core of the MCP surface: turn a workspace's active connections into MCP
// tools, and execute a tool call through the SAME gates as the rest of the
// product — per-connection risk controls, approval queue for write/destructive,
// and a full audit-log entry. The AI assistant on the other end never sees
// credentials; it only sees tool results.

export interface McpEndpointRow {
  id: string
  workspace_id: string
  token: string
  enabled: boolean
  created_by: string
}

/** Table missing (migration 048 not applied yet) → feature is dormant, not broken. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01'
}

export async function getEndpointByToken(token: string): Promise<McpEndpointRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mcp_endpoints')
    .select('id, workspace_id, token, enabled, created_by')
    .eq('token', token)
    .eq('enabled', true)
    .single()
  if (error || !data) return null
  // Fire-and-forget usage timestamp.
  void admin.from('mcp_endpoints').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return data as McpEndpointRow
}

interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

interface ToolBinding {
  connectionId: string
  connectionLabel: string
  connectorName: string
  connectorSlug: string
  isSimulated: boolean
  allowedRiskLevels: string[] | null
  action: ActionDef
}

// MCP tool names must be [a-zA-Z0-9_-], ≤64 chars.
function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'x'
}

/** Build the tool list + a name→binding map for a workspace's active connections. */
export async function buildTools(workspaceId: string): Promise<{ tools: McpTool[]; bindings: Map<string, ToolBinding> }> {
  const admin = createAdminClient()
  const { data: connections } = await admin
    .from('connections')
    .select('id, label, is_simulated, allowed_risk_levels, connector:connectors(slug, name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at')

  const tools: McpTool[] = []
  const bindings = new Map<string, ToolBinding>()
  const usedNames = new Set<string>()

  for (const conn of connections ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = conn.connector as any
    const manifest = getConnector(meta?.slug)
    if (!manifest) continue

    const base = sanitize(conn.label || meta?.name || meta?.slug || 'connector')
    for (const action of manifest.actions) {
      let name = `${base}__${sanitize(action.slug)}`.slice(0, 64)
      // Two connections with the same label: disambiguate with the id prefix.
      if (usedNames.has(name)) name = `${base}_${conn.id.slice(0, 6)}__${sanitize(action.slug)}`.slice(0, 64)
      usedNames.add(name)

      tools.push({
        name,
        description:
          `[${meta?.name ?? meta?.slug} · ${conn.label}${conn.is_simulated ? ' · simulated' : ''} · risk: ${action.risk}] ` +
          `${action.description}` +
          (action.risk !== 'read' ? ' NOTE: this action requires human approval in OrbitAPI — calling it queues an approval request and returns immediately.' : ''),
        inputSchema: (action.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
      })
      bindings.set(name, {
        connectionId: conn.id,
        connectionLabel: conn.label,
        connectorName: meta?.name ?? meta?.slug ?? '',
        connectorSlug: meta?.slug ?? '',
        isSimulated: !!conn.is_simulated,
        allowedRiskLevels: (conn as { allowed_risk_levels?: string[] | null }).allowed_risk_levels ?? null,
        action,
      })
    }
  }
  return { tools, bindings }
}

/** Execute one tool call with the product's normal gates. Returns text for the model. */
export async function executeTool(
  endpoint: McpEndpointRow,
  binding: ToolBinding,
  params: Record<string, unknown>,
): Promise<{ text: string; isError?: boolean }> {
  const admin = createAdminClient()
  const { action } = binding

  if (!riskAllowed(binding.allowedRiskLevels, action.risk)) {
    return { text: `${action.risk} actions are disabled for the "${binding.connectionLabel}" connection.`, isError: true }
  }

  // Write/destructive: queue for human approval — never execute directly from
  // an external assistant. Same flow as skill approvals.
  if (action.risk !== 'read') {
    const { error } = await admin.from('pending_actions').insert({
      workspace_id: endpoint.workspace_id,
      user_id: endpoint.created_by,
      connection_id: binding.connectionId,
      action_slug: action.slug,
      params,
      summary: `${action.name} on ${binding.connectionLabel} — requested via MCP (external AI assistant)`,
      status: 'pending',
    })
    if (error) return { text: `Could not queue the approval: ${error.message}`, isError: true }
    await createNotification({
      workspaceId: endpoint.workspace_id,
      userId: endpoint.created_by,
      type: 'pending_action',
      title: 'MCP action needs approval',
      body: `${action.name} on ${binding.connectionLabel} — from an external AI assistant`,
      link: '/approvals',
    })
    return {
      text:
        `Queued for human approval: "${action.name}" on ${binding.connectionLabel}. ` +
        `A workspace admin must approve it on the OrbitAPI Approvals page before it runs. ` +
        `Tell the user to check /approvals.`,
    }
  }

  // Read: execute directly, exactly like /api/execute.
  const { data: conn } = await admin
    .from('connections')
    .select('*')
    .eq('id', binding.connectionId)
    .eq('status', 'active')
    .single()
  if (!conn) return { text: 'Connection not found or inactive.', isError: true }

  const started = Date.now()
  const result = binding.isSimulated
    ? await resolveSimulatedAction({
        workspaceId: endpoint.workspace_id,
        connectionId: binding.connectionId,
        connectorSlug: binding.connectorSlug,
        connectorName: binding.connectorName,
        action,
        params,
      })
    : await action.execute(await resolveCredentials(conn), params)

  await admin.from('audit_log').insert({
    workspace_id: endpoint.workspace_id,
    actor_type: 'user',
    actor_id: endpoint.created_by,
    actor_label: 'External AI (MCP)',
    connection_id: binding.connectionId,
    action_slug: action.slug,
    risk: action.risk,
    params,
    response: result.ok ? (result.data ?? null) : { error: result.error },
    duration_ms: Date.now() - started,
    result_status: result.ok ? 'success' : 'error',
    result_summary: result.ok
      ? JSON.stringify(result.data).slice(0, 500)
      : (result.error ?? 'Unknown error'),
  })

  if (!result.ok) return { text: `Error: ${result.error ?? 'Unknown error'}`, isError: true }
  return { text: JSON.stringify(result.data ?? null, null, 2).slice(0, 50_000) }
}

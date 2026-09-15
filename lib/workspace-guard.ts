import { createAdminClient } from '@/lib/supabase/admin'

// Cross-workspace reference checks.
//
// API routes write with the service-role client, which bypasses RLS, so any id
// taken from a request body (group_id, connection_id, ...) must be checked
// against the caller's workspace before it is stored. Otherwise a resource in
// workspace A can end up pointing at workspace B's group or connection.

/** True when `groupId` is empty (no group) or belongs to `workspaceId`. */
export async function groupInWorkspace(groupId: unknown, workspaceId: string): Promise<boolean> {
  if (!groupId) return true
  if (typeof groupId !== 'string') return false
  const { data } = await createAdminClient()
    .from('groups').select('workspace_id').eq('id', groupId).maybeSingle()
  return !!data && data.workspace_id === workspaceId
}

/** True when every id in `ids` is a connection in `workspaceId`. */
export async function connectionsInWorkspace(ids: unknown, workspaceId: string): Promise<boolean> {
  if (!Array.isArray(ids) || ids.length === 0) return Array.isArray(ids)
  if (!ids.every(i => typeof i === 'string')) return false
  const unique = [...new Set(ids as string[])]
  const { data } = await createAdminClient()
    .from('connections').select('id').in('id', unique).eq('workspace_id', workspaceId)
  return (data ?? []).length === unique.length
}

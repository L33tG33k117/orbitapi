import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSelfHost } from '@/lib/edition'
import { OFFLINE_PAUSED_MESSAGE } from '@/lib/offline-paths'

// Offline mode (cloud side). See migration 059 for the why.
//
// On the self-hosted edition itself this is always false: that install IS the
// offline product and everything on it is live.

export async function isWorkspaceOffline(workspaceId: string | null | undefined): Promise<boolean> {
  if (isSelfHost() || !workspaceId) return false
  const { data, error } = await createAdminClient()
    .from('workspaces').select('offline_mode').eq('id', workspaceId).maybeSingle()
  if (error) return false // column missing before 059: behave as online
  return (data as { offline_mode?: boolean } | null)?.offline_mode === true
}

/** Workspace ids currently in offline mode, for the cloud scheduler to skip. */
export async function offlineWorkspaceIds(): Promise<Set<string>> {
  if (isSelfHost()) return new Set()
  const { data, error } = await createAdminClient()
    .from('workspaces').select('id').eq('offline_mode', true)
  if (error) return new Set()
  return new Set((data ?? []).map(w => w.id as string))
}

/**
 * API guard for routes that touch live connections or run automation:
 *   const paused = await offlineModeGuard(membership.workspace_id); if (paused) return paused
 * 409 Conflict: the request is valid, the workspace is just in the wrong mode.
 */
export async function offlineModeGuard(workspaceId: string | null | undefined): Promise<NextResponse | null> {
  if (!(await isWorkspaceOffline(workspaceId))) return null
  return NextResponse.json(
    { error: 'offline_mode', message: `${OFFLINE_PAUSED_MESSAGE} Switch back to online mode in Settings → Downloads to use it here.` },
    { status: 409 },
  )
}

import { createAdminClient } from '@/lib/supabase/admin'

// Governance audit trail — WHO changed WHAT (config, members, access), as opposed
// to Activity/audit_log which records what ran. Logging must never break the
// operation it records, so every failure (including a not-yet-migrated table) is
// swallowed. See migration 049.

export type AuditCategory =
  | 'members' | 'connector' | 'access' | 'workspace' | 'security' | 'billing' | 'automation'

export async function logAuditEvent(opts: {
  workspaceId: string | null | undefined
  userId?: string | null
  actorEmail?: string | null
  category: AuditCategory
  action: string
  target?: string | null
  summary: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!opts.workspaceId) return
  try {
    const admin = createAdminClient()
    await admin.from('audit_events').insert({
      workspace_id: opts.workspaceId,
      actor_user_id: opts.userId ?? null,
      actor_email: opts.actorEmail ?? null,
      category: opts.category,
      action: opts.action,
      target: opts.target ?? null,
      summary: opts.summary,
      metadata: opts.metadata ?? null,
    })
  } catch {
    /* never block the operation being audited */
  }
}

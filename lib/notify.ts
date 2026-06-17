import { createAdminClient } from '@/lib/supabase/admin'

type NotifType = 'skill_completed' | 'skill_failed' | 'pending_action' | 'info'

interface NotifParams {
  workspaceId: string
  userId?: string        // omit for workspace-wide (all admins see it)
  type: NotifType
  title: string
  body?: string
  link?: string
}

export async function createNotification(p: NotifParams): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    workspace_id: p.workspaceId,
    user_id: p.userId ?? null,
    type: p.type,
    title: p.title,
    body: p.body ?? null,
    link: p.link ?? null,
  })
}

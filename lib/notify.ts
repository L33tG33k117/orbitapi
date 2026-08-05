import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailConfigured } from '@/lib/email'
import { getAppUrl } from '@/lib/app-url'

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

// Email opted-in workspace admins/owners a summary of a skill run. Best-effort:
// silently does nothing when email isn't configured (no RESEND_API_KEY). The
// in-app notification is created separately and always; this is the extra
// email channel gated by each user's `email_skill_notifications` preference.
export async function emailSkillRunOutcome(p: {
  workspaceId: string
  skillName: string
  outcome: 'completed' | 'failed'
  summary: string
  link: string
}): Promise<void> {
  if (!emailConfigured()) return

  const admin = createAdminClient()

  // Admins/owners are the audience for run summaries (members can't manage skills).
  const { data: members } = await admin
    .from('memberships')
    .select('user_id, role')
    .eq('workspace_id', p.workspaceId)
    .neq('role', 'member')
  if (!members || members.length === 0) return

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, email_skill_notifications')
    .in('id', members.map(m => m.user_id))
  if (!profiles) return

  // 'all' gets every run; 'failures' only gets failures; 'off' gets nothing.
  const recipients = profiles
    .filter(pr => pr.email && (
      pr.email_skill_notifications === 'all' ||
      (pr.email_skill_notifications === 'failures' && p.outcome === 'failed')
    ))
    .map(pr => pr.email as string)
  if (recipients.length === 0) return

  const url = `${getAppUrl()}${p.link}`
  const verb = p.outcome === 'failed' ? 'failed' : 'completed'
  const subject = `${p.skillName} ${verb}`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="margin:0 0 8px">${escapeHtml(p.skillName)} ${verb}</h2>
      <p style="color:#555;margin:0 0 16px">${escapeHtml(p.summary)}</p>
      <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none">View run history</a>
    </div>`
  const text = `${p.skillName} ${verb}\n\n${p.summary}\n\nView: ${url}`

  await sendEmail({ to: recipients, subject, html, text })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

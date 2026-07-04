import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuditTable } from './audit-table'
import { PageHero } from '@/components/page-hero'
import { InsightsTabs } from '@/components/insights-tabs'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'

  const admin = createAdminClient()
  const [actionsRes, changesRes] = await Promise.all([
    admin.from('audit_log')
      .select('id, actor_type, actor_label, action_slug, risk, result_status, result_summary, response, duration_ms, params, connection_id, replay_of, created_at, connection:connections(label)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(500),
    // Governance events (migration 049). Tolerate the table being absent.
    admin.from('audit_events')
      .select('id, actor_email, category, action, target, summary, metadata, created_at')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actions = (actionsRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changes = (changesRes.data ?? []) as any[]

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <PageHero
        eyebrow="Insights"
        title="Audit Log"
        description="The governance record — who changed what (settings, members, connectors, access) and every action run, for compliance and troubleshooting."
        stats={[
          { label: 'changes', value: changes.length },
          { label: 'actions', value: actions.length },
        ]}
      />

      <InsightsTabs />

      {changes.length === 0 && actions.length === 0 ? (
        <div className="py-16 text-center border rounded-lg text-muted-foreground">
          <p className="font-medium">Nothing recorded yet.</p>
          <p className="text-sm mt-1">Configuration changes and actions show up here as you use the workspace.</p>
        </div>
      ) : (
        <AuditTable changes={changes} actions={actions} isAdmin={isAdmin} />
      )}
    </div>
  )
}

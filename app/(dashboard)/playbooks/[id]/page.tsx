import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { PlaybookDetail } from './playbook-detail'

type Params = { params: Promise<{ id: string }> }

export default async function PlaybookDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: playbook } = await admin
    .from('playbooks')
    .select('*, group:groups(id, name, color, group_connections(connection_id))')
    .eq('id', id)
    .single()

  if (!playbook || playbook.workspace_id !== membership.workspace_id) notFound()

  // Build the action palette for the step editor from the group's connections.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connIds: string[] = ((playbook.group as any)?.group_connections ?? []).map((gc: { connection_id: string }) => gc.connection_id)
  let availableActions: { connectionId: string; label: string; actions: { slug: string; name: string; risk: string }[] }[] = []
  if (connIds.length) {
    const { data: conns } = await admin
      .from('connections')
      .select('id, label, connector:connectors(slug, name)')
      .in('id', connIds)
      .eq('status', 'active')
    availableActions = (conns ?? []).map(c => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slug = (c.connector as any)?.slug
      const manifest = getConnector(slug)
      return {
        connectionId: c.id,
        label: c.label,
        actions: (manifest?.actions ?? []).map(a => ({ slug: a.slug, name: a.name, risk: a.risk })),
      }
    })
  }

  const { data: runs } = await admin
    .from('playbook_runs')
    .select('*')
    .eq('playbook_id', id)
    .order('started_at', { ascending: false })
    .limit(25)

  return (
    <PlaybookDetail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playbook={playbook as any}
      availableActions={availableActions}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runs={(runs ?? []) as any}
      isAdmin={membership.role !== 'member'}
    />
  )
}

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { ManualClient } from './manual-client'

export default async function ManualPage({ params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user!.id)
    .single()

  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('connections')
    .select('id, label, status, workspace_id, connector:connectors(slug, name, category)')
    .eq('id', connectionId)
    .single()

  if (!connection) notFound()
  if ((connection as { workspace_id: string }).workspace_id !== membership.workspace_id) redirect('/connectors')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = connection.connector as any
  const manifest = getConnector(meta?.slug)
  if (!manifest) notFound()

  // Check member grants if role = member
  let allowedActions: string[] | null = null
  if (membership.role === 'member') {
    const { data: grant } = await admin
      .from('connection_grants')
      .select('level')
      .eq('user_id', user!.id)
      .eq('connection_id', connectionId)
      .single()
    if (!grant) redirect('/connectors')
    allowedActions = manifest.actions
      .filter(a => grant.level === 'read_write' || a.risk === 'read')
      .map(a => a.slug)
  }

  const actions = manifest.actions
    .filter(a => allowedActions === null || allowedActions.includes(a.slug))
    .map(a => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      risk: a.risk as 'read' | 'write' | 'destructive',
      params: Object.entries(a.inputSchema?.properties ?? {}).map(([key, def]) => {
        const d = def as { type?: string; description?: string; enum?: string[] }
        return {
          key,
          type: d.type ?? 'string',
          description: d.description ?? '',
          enum: (d.enum as string[] | undefined) ?? null,
          required: (a.inputSchema?.required ?? []).includes(key),
        }
      }),
    }))

  return (
    <ManualClient
      connectionId={connectionId}
      connectionLabel={connection.label}
      connectorSlug={meta?.slug ?? ''}
      connectorName={meta?.name ?? ''}
      connectorCategory={meta?.category ?? ''}
      status={connection.status}
      actions={actions}
    />
  )
}

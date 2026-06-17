import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { getConnector } from '@/connectors'
import { ConnectionsPanel } from './connections-panel'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: group } = await admin
    .from('groups')
    .select('*, group_connections(connection_id), skills(id, name, autonomy, enabled)')
    .eq('id', id)
    .single()

  if (!group) notFound()
  if (group.workspace_id !== membership.workspace_id) redirect('/groups')

  const { data: allConnections } = await admin
    .from('connections')
    .select('id, label, connector:connectors(slug, name)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')

  const inGroupIds = new Set((group.group_connections ?? []).map((gc: { connection_id: string }) => gc.connection_id))
  const isAdmin = membership.role !== 'member'

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl shrink-0" style={{ backgroundColor: group.color }} />
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && <p className="text-muted-foreground text-sm mt-0.5">{group.description}</p>}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Connections in this group</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Skills attached to this group can only call APIs from these connections.
          </p>
        </div>
        <ConnectionsPanel
          groupId={id}
          allConnections={(allConnections ?? []) as unknown as { id: string; label: string; connector: { slug: string; name: string } | null }[]}
          inGroupIds={[...inGroupIds] as string[]}
          isAdmin={isAdmin}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Skills</h2>
          {isAdmin && (
            <Link
              href={`/skills?groupId=${id}`}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Create skill for this group →
            </Link>
          )}
        </div>
        {(group.skills ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No skills yet. Create a skill to automate workflows using this group&apos;s connections.
          </p>
        ) : (
          <div className="space-y-2">
            {(group.skills as { id: string; name: string; autonomy: string; enabled: boolean }[]).map(s => (
              <Link
                key={s.id}
                href={`/skills/${s.id}`}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                </div>
                <Badge variant={s.autonomy === 'autonomous' ? 'default' : 'secondary'}>
                  {s.autonomy}
                </Badge>
                <Badge variant={s.enabled ? 'default' : 'outline'}>
                  {s.enabled ? 'enabled' : 'disabled'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            To edit group name/color or delete this group, use the{' '}
            <Link href="/groups" className="underline">Groups list</Link> — edit coming soon.
          </p>
        </div>
      )}
    </div>
  )
}

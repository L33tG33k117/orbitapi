import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteMemberForm } from './invite-form'
import { MemberList } from './member-list'
import { CustomRolesManager } from './custom-roles'
import { Users } from 'lucide-react'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  if (!membership || membership.role === 'member') redirect('/dashboard')

  const admin = createAdminClient()

  const [
    { data: members },
    { data: connections },
    { data: grants },
    { data: customRoles },
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select('*, profile:profiles(*)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at'),
    admin
      .from('connections')
      .select('id, label, connector:connectors(name)')
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'active'),
    admin
      .from('connection_grants')
      .select('user_id, connection_id, level'),
    admin
      .from('custom_roles')
      .select('id, name, description, permissions')
      .eq('workspace_id', membership.workspace_id)
      .order('name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws = membership.workspace as any
  const activeCount = (members ?? []).filter((m: { suspended_at: string | null }) => !m.suspended_at).length
  const suspendedCount = (members ?? []).filter((m: { suspended_at: string | null }) => m.suspended_at).length

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Members</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage who has access to <span className="font-medium text-foreground">{ws?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span><span className="font-semibold text-foreground">{activeCount}</span> active</span>
          {suspendedCount > 0 && (
            <span className="text-amber-500"><span className="font-semibold">{suspendedCount}</span> suspended</span>
          )}
        </div>
      </div>

      <InviteMemberForm workspaceId={membership.workspace_id} customRoles={customRoles ?? []} />

      <MemberList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        members={(members ?? []) as any}
        currentUserId={user!.id}
        currentRole={membership.role}
        workspaceId={membership.workspace_id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connections={(connections ?? []) as any}
        grants={(grants ?? []) as { user_id: string; connection_id: string; level: string }[]}
        customRoles={(customRoles ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))}
      />

      <div className="border-t pt-8">
        <CustomRolesManager
          workspaceId={membership.workspace_id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          roles={(customRoles ?? []) as any}
        />
      </div>
    </div>
  )
}

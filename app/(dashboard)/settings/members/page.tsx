import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InviteMemberForm } from './invite-form'
import { MemberList } from './member-list'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  if (!membership || membership.role === 'member') redirect('/dashboard')

  const { data: members } = await supabase
    .from('memberships')
    .select('*, profile:profiles(*)')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at')

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-muted-foreground mt-1">Manage who has access to {membership.workspace.name}</p>
      </div>
      <InviteMemberForm workspaceId={membership.workspace_id} />
      <MemberList members={members ?? []} currentUserId={user!.id} currentRole={membership.role} workspaceId={membership.workspace_id} />
    </div>
  )
}

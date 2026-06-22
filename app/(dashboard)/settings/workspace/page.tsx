import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceForm } from './workspace-form'

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  if (!membership || membership.role === 'member') redirect('/dashboard')

  const workspace = membership.workspace as {
    id: string; name: string
    connection_delete_default?: 'trash' | 'permanent'
    connection_delete_locked?: boolean
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Workspace settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace configuration.</p>
      </div>
      <WorkspaceForm
        workspaceId={workspace.id}
        currentName={workspace.name}
        isOwner={membership.role === 'owner'}
        connectionDeleteDefault={workspace.connection_delete_default ?? 'trash'}
        connectionDeleteLocked={workspace.connection_delete_locked ?? false}
      />
    </div>
  )
}

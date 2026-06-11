import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  if (!membership || membership.role === 'member') redirect('/dashboard')

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Workspace settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace</p>
      </div>
      <div className="border rounded-lg p-4 space-y-1">
        <p className="text-sm font-medium">Workspace name</p>
        <p className="text-lg">{(membership.workspace as { name: string }).name}</p>
      </div>
    </div>
  )
}

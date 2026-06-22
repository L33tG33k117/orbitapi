import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('connection_delete_preference, email_skill_notifications')
    .eq('id', user!.id)
    .single()

  // If the workspace locks the deletion policy, the per-user preference is moot.
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user!.id).single()
  const { data: ws } = membership
    ? await admin.from('workspaces').select('connection_delete_locked').eq('id', membership.workspace_id).single()
    : { data: null }
  const connectionDeleteLocked = !!ws?.connection_delete_locked

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and password</p>
      </div>

      <ProfileForm
        email={user?.email ?? ''}
        fullName={(user?.user_metadata?.full_name as string | undefined) ?? ''}
        userId={user?.id ?? ''}
        connectionDeletePreference={(profile?.connection_delete_preference as 'trash' | 'permanent') ?? 'trash'}
        emailSkillNotifications={(profile?.email_skill_notifications as 'off' | 'failures' | 'all') ?? 'failures'}
        connectionDeleteLocked={connectionDeleteLocked}
      />
    </div>
  )
}

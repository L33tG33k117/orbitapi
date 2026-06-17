import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { CommandPalette } from '@/components/command-palette'
import { FloatingAssistant } from '@/components/floating-assistant'
import { Toaster } from 'sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const cookieStore = await cookies()
  const impCookie = cookieStore.get('__orbit_imp')

  // Determine effective user (impersonation)
  const effectiveUserId = impCookie?.value ?? user.id

  const [membershipResult, profileResult] = await Promise.all([
    supabase
      .from('memberships')
      .select('*, workspace:workspaces(*)')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single(),
    admin
      .from('profiles')
      .select('super_admin, email, full_name')
      .eq('id', user.id)
      .single(),
  ])

  if (!membershipResult.data) redirect('/onboarding')

  const isAdmin = membershipResult.data.role !== 'member'

  const { data: ownedRequests } = await admin
    .from('connector_requests')
    .select('id')
    .eq('user_id', effectiveUserId)
    .neq('status', 'rejected')

  const ownedIds = (ownedRequests ?? []).map(r => r.id)

  const [{ count: pendingApprovals }, { count: unreadConnectorMessages }] = await Promise.all([
    isAdmin
      ? admin
          .from('pending_actions')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', membershipResult.data.workspace_id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    ownedIds.length > 0
      ? admin
          .from('connector_request_messages')
          .select('*', { count: 'exact', head: true })
          .in('request_id', ownedIds)
          .eq('sender_type', 'admin')
          .is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  // Impersonation info for topbar banner
  let impersonating: { id: string; name: string; email: string } | null = null
  if (impCookie?.value) {
    const { data: impProfile } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', impCookie.value)
      .single()
    if (impProfile) {
      impersonating = {
        id: impProfile.id,
        name: impProfile.full_name ?? '',
        email: impProfile.email ?? '',
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        workspace={membershipResult.data.workspace}
        role={membershipResult.data.role}
        tier={membershipResult.data.workspace?.tier ?? 'free'}
        flags={membershipResult.data.workspace?.feature_flags ?? {}}
        superAdmin={profileResult.data?.super_admin ?? false}
        pendingApprovals={pendingApprovals ?? 0}
        unreadConnectorMessages={unreadConnectorMessages ?? 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          user={user}
          role={membershipResult.data.role}
          workspaceId={membershipResult.data.workspace_id}
          impersonating={impersonating}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
      <FloatingAssistant />
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}

import { CHANGELOG } from '@/lib/release-notes/customer'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { CommandPalette } from '@/components/command-palette'
import { FloatingAssistant } from '@/components/floating-assistant'
import { Toaster } from 'sonner'
import { getSelfhostAccess } from '@/lib/selfhost-access'
import { isSelfHost } from '@/lib/edition'
import { hasCapability, type FeatureOverrides } from '@/lib/entitlements'
import { OfflineModeShell } from '@/components/offline-mode-shell'
import type { WorkspaceTier } from '@/types'

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

  // Self-hosted customers fetch their bundles from the cloud, so the Downloads
  // entry has to exist here — but only for them. Everyone else must never see a
  // nav item for a product they have not bought. Skipped entirely on a
  // self-hosted install, where there is nothing to download from.
  const selfhostAccess = isSelfHost()
    ? null
    : await getSelfhostAccess(user.id, profileResult.data?.email ?? user.email)

  // Offline (self-hosted) settings are only relevant to people who run it:
  // the self-hosted build itself, or a cloud account holding a self-hosted
  // (Enterprise) licence. Everyone else never sees them.
  const ws = membershipResult.data.workspace as { tier?: string; feature_flags?: FeatureOverrides; offline_mode?: boolean } | null
  const offlineEligible = isSelfHost() || !!selfhostAccess
  // Exclusive mode: a cloud workspace switched to offline pauses the online product.
  const offlineActive = !isSelfHost() && !!selfhostAccess && ws?.offline_mode === true
  const byoLlm = isSelfHost() || hasCapability((ws?.tier ?? 'free') as WorkspaceTier, ws?.feature_flags ?? null, 'byo_llm')

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
    // The shell sits on the deep-space sidebar color in both themes; the app
    // content floats on top of it as a rounded, elevated panel.
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <Sidebar
        workspace={membershipResult.data.workspace}
        role={membershipResult.data.role}
        tier={membershipResult.data.workspace?.tier ?? 'free'}
        flags={membershipResult.data.workspace?.feature_flags ?? {}}
        superAdmin={profileResult.data?.super_admin ?? false}
        pendingApprovals={pendingApprovals ?? 0}
        unreadConnectorMessages={unreadConnectorMessages ?? 0}
        selfhostDownloads={!!selfhostAccess}
        offlineEligible={offlineEligible}
        offlineActive={offlineActive}
        byoLlm={byoLlm}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:py-2 lg:pr-2">
        <div className="app-ambiance flex-1 flex flex-col overflow-hidden min-w-0 lg:rounded-2xl lg:border lg:border-white/10 lg:shadow-[0_0_60px_-20px_oklch(0.5_0.2_280/40%)]">
          <TopBar
            user={user}
            role={membershipResult.data.role}
            workspaceId={membershipResult.data.workspace_id}
            impersonating={impersonating}
            newestReleaseDate={CHANGELOG[0]?.date ?? null}
          />
          <main className="flex-1 overflow-y-auto">
            <OfflineModeShell active={offlineActive} canManage={isAdmin}>
              {children}
            </OfflineModeShell>
          </main>
        </div>
      </div>
      <CommandPalette />
      <FloatingAssistant />
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}

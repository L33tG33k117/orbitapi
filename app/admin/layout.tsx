import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminSidebar } from '@/components/admin-sidebar'
import { TopBar } from '@/components/top-bar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin()
  if (!user) redirect('/dashboard')

  const admin = createAdminClient()
  const [
    { data: profile },
    { count: openReports },
    { count: newFeedback },
    { count: pendingRequests },
    { count: openErrors },
    { count: newContact },
  ] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', user.id).single(),
    admin.from('connector_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('connector_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    // Resolves to { count: null } if migration 052 hasn't been applied — the
    // badge just stays at zero rather than breaking the whole admin shell.
    admin.from('error_events').select('*', { count: 'exact', head: true }).eq('resolved', false),
    // Same graceful-before-055 story.
    admin.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ])

  return (
    // Same floating-panel shell as the main dashboard: deep-space backdrop,
    // content elevated as a rounded panel, sidebar blending into the space.
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <AdminSidebar
        email={profile?.email ?? user.email ?? ''}
        fullName={profile?.full_name ?? null}
        openReports={openReports ?? 0}
        newFeedback={newFeedback ?? 0}
        pendingRequests={pendingRequests ?? 0}
        openErrors={openErrors ?? 0}
        newContact={newContact ?? 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:py-2 lg:pr-2">
        <div className="app-ambiance flex-1 flex flex-col overflow-hidden min-w-0 lg:rounded-2xl lg:border lg:border-white/10 lg:shadow-[0_0_60px_-20px_oklch(0.5_0.2_280/40%)]">
          <TopBar
            user={user}
            role="owner"
            workspaceId=""
            adminInbox
          />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

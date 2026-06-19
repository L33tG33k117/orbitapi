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
  ] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', user.id).single(),
    admin.from('connector_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('connector_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar
        email={profile?.email ?? user.email ?? ''}
        fullName={profile?.full_name ?? null}
        openReports={openReports ?? 0}
        newFeedback={newFeedback ?? 0}
        pendingRequests={pendingRequests ?? 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
  )
}

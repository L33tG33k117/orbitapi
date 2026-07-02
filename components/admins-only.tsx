import { Lock, Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'

interface AdminsOnlyProps {
  workspaceId: string
  eyebrow?: string
  title: string
  /** What this page does, in plain words — shown so members know what they're missing. */
  description: string
}

// Friendly admin-gated page state: instead of a bare "Admins only." dead end,
// explain what the page does and name the workspace admins to ask for access.
export async function AdminsOnly({ workspaceId, eyebrow, title, description }: AdminsOnlyProps) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('memberships')
    .select('role, profile:profiles(email, full_name)')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin'])
    .order('created_at', { ascending: true })
    .limit(5)

  const admins = (data ?? [])
    .map(m => {
      const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { email?: string | null; full_name?: string | null } | null
      return p?.email ? { name: p.full_name?.trim() || p.email, email: p.email } : null
    })
    .filter((a): a is { name: string; email: string } => a !== null)

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-muted-foreground" />
          This page is managed by workspace admins
        </div>
        <p className="text-sm text-muted-foreground">
          Your account doesn&apos;t have admin access, so you can&apos;t make changes here.
          If you need something on this page, ask a workspace admin:
        </p>
        {admins.length > 0 ? (
          <ul className="space-y-1.5">
            {admins.map(a => (
              <li key={a.email} className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {a.name !== a.email && <span className="font-medium">{a.name}</span>}
                <a href={`mailto:${a.email}`} className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  {a.email}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find an admin to list — reach out to whoever invited you to this workspace.
          </p>
        )}
      </div>
    </div>
  )
}

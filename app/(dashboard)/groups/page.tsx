import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SectionIntro } from '@/components/section-intro'
import { PageHero } from '@/components/page-hero'
import { CreateGroupForm } from './create-group-form'
import { GroupDeleteButton } from './group-delete-button'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'

  const admin = createAdminClient()
  const { data: groups } = await admin
    .from('groups')
    .select('*, group_connections(connection_id), skills(id)')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHero
        eyebrow="Connect"
        title="Groups"
        description="Bundle related connections together. Skills are attached to groups, and the AI only uses APIs in that group."
        stats={[{ label: 'groups', value: (groups ?? []).length }]}
      />

      <SectionIntro id="groups" />

      {isAdmin && <div data-tour="group-create"><CreateGroupForm /></div>}

      <div className="space-y-2">
        {(groups ?? []).length === 0 && (
          <div className="py-16 text-center border border-dashed rounded-xl text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">No groups yet</p>
            <p className="text-sm">Create a group to bundle connections and attach skills to them.</p>
          </div>
        )}
        {(groups ?? []).map(g => {
          const connCount = (g.group_connections ?? []).length
          const skillCount = (g.skills ?? []).length
          return (
            <div key={g.id} className="relative group/card">
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all pr-12"
              >
                <div
                  className="h-10 w-10 rounded-xl shrink-0"
                  style={{ backgroundColor: g.color ?? '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{g.name}</p>
                  {g.description && (
                    <p className="text-sm text-muted-foreground truncate">{g.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                    {connCount} API{connCount !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    {skillCount} skill{skillCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
              {isAdmin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <GroupDeleteButton groupId={g.id} groupName={g.name} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

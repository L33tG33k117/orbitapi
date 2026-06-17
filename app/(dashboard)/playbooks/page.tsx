import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleLabel } from '@/lib/schedules'
import { pageGate } from '@/components/page-gate'
import { CreatePlaybookForm } from './create-playbook-form'

// Feature #1 — Autonomous response playbooks with approval chains.
export default async function PlaybooksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('playbooks'); if (gate) return gate

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()

  const [{ data: playbooks }, { data: groups }, { data: recentRuns }] = await Promise.all([
    admin.from('playbooks')
      .select('*, group:groups(id, name, color)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at'),
    admin.from('groups').select('id, name, color').eq('workspace_id', membership.workspace_id).order('name'),
    admin.from('playbook_runs')
      .select('playbook_id, status')
      .eq('workspace_id', membership.workspace_id)
      .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500),
  ])

  const runCount: Record<string, number> = {}
  for (const r of recentRuns ?? []) runCount[r.playbook_id] = (runCount[r.playbook_id] ?? 0) + 1

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Playbooks</h1>
        <p className="text-muted-foreground mt-1">
          Multi-step automations with conditional branching and severity-driven autonomy. A playbook can
          auto-act on critical events, pause for human approval on uncertain ones, and just notify on the rest.
        </p>
      </div>

      {isAdmin && (
        <CreatePlaybookForm groups={(groups ?? []) as { id: string; name: string; color: string }[]} />
      )}

      <div className="space-y-2">
        {(playbooks ?? []).length === 0 && (
          <div className="py-10 text-center border border-dashed rounded-xl text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">No playbooks yet</p>
            <p className="text-xs">Create one above, or install a vertical bundle from the Bundles page.</p>
          </div>
        )}
        {(playbooks ?? []).map(p => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = p.group as any
          const steps = (p.definition?.steps ?? []).length
          return (
            <Link
              key={p.id}
              href={`/playbooks/${p.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div
                className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: g?.color ?? '#6366f1' }}
              >
                {p.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {g ? g.name : 'No group'} · {steps} step{steps !== 1 ? 's' : ''}
                  {p.trigger_type === 'schedule' && p.schedule ? ` · ${scheduleLabel(p.schedule)}` : ''}
                  {runCount[p.id] ? ` · ${runCount[p.id]} run${runCount[p.id] !== 1 ? 's' : ''}/7d` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                  {p.trigger_type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                  p.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {p.enabled ? 'on' : 'off'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

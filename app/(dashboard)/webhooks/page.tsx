import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pageGate } from '@/components/page-gate'
import { SectionIntro } from '@/components/section-intro'
import { WebhooksClient } from './webhooks-client'

export default async function WebhooksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('webhooks'); if (gate) return gate

  if (membership.role === 'member') {
    return <div className="p-8 max-w-3xl"><h1 className="text-2xl font-bold">Webhooks</h1><p className="text-muted-foreground mt-2">Admins only.</p></div>
  }

  const admin = createAdminClient()
  const [{ data: endpoints }, { data: skills }, { data: playbooks }] = await Promise.all([
    admin.from('webhook_endpoints').select('*').eq('workspace_id', membership.workspace_id).order('created_at', { ascending: false }),
    admin.from('skills').select('id, name').eq('workspace_id', membership.workspace_id).order('name'),
    admin.from('playbooks').select('id, name').eq('workspace_id', membership.workspace_id).order('name'),
  ])

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground mt-1">
          HMAC-signed inbound endpoints. Trigger a skill or playbook, or emit an event that resumes paused
          playbook runs. Every delivery is logged and replay-testable.
        </p>
      </div>

      <SectionIntro id="webhooks" />
      <WebhooksClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialEndpoints={(endpoints ?? []) as any}
        skills={(skills ?? []) as { id: string; name: string }[]}
        playbooks={(playbooks ?? []) as { id: string; name: string }[]}
      />
    </div>
  )
}

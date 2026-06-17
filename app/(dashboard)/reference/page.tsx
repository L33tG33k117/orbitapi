import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { pageGate } from '@/components/page-gate'
import { RefClient } from './ref-client'

export default async function ReferencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('api_reference'); if (gate) return gate

  const admin = createAdminClient()

  const { data: connections } = await admin
    .from('connections')
    .select('id, label, connector:connectors(slug, name, category)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')
    .order('label')

  const connectors = (connections ?? []).map(c => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = c.connector as any
    const manifest = getConnector(meta?.slug)
    return {
      connectionId: c.id,
      label: c.label,
      slug: meta?.slug ?? '',
      name: meta?.name ?? '',
      category: meta?.category ?? '',
      actions: manifest?.actions.map(a => ({
        slug: a.slug,
        name: a.name,
        description: a.description,
        risk: a.risk,
        inputSchema: a.inputSchema,
      })) ?? [],
    }
  })

  return <RefClient connectors={connectors} />
}

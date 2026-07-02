import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pageGate } from '@/components/page-gate'
import { DiscoverClient } from './discover-client'
import { PageHeader } from '@/components/page-header'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const gate = await pageGate('discover'); if (gate) return gate
  if (membership.role === 'member') {
    return <div className="p-8 max-w-3xl"><h1 className="text-2xl font-bold">Discover a connector</h1><p className="text-muted-foreground mt-2">Admins only.</p></div>
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Connect"
        title="Discover a connector"
        description="Name any app (or paste its API documentation link) and Orbit will map out what it can do and propose a ready-to-build connector for it."
      />
      <DiscoverClient />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pageGate } from '@/components/page-gate'
import { DiscoverClient } from './discover-client'

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
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Discover a connector</h1>
        <p className="text-muted-foreground mt-1">
          Point Orbit at an API&apos;s OpenAPI spec (or just name it) and it will introspect the schema and
          propose a connector — actions, methods, and risk classification — ready to request as a build.
        </p>
      </div>
      <DiscoverClient />
    </div>
  )
}

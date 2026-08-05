import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { isSelfHost } from '@/lib/edition'
import { UpdatesClient } from './updates-client'

export const dynamic = 'force-dynamic'

export default async function UpdatesPage() {
  // Cloud updates itself; there is nothing here to manage.
  if (!isSelfHost()) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user!.id).single()
  if (!membership || membership.role === 'member') redirect('/dashboard')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Updates"
        description="Check and apply an update you've downloaded."
      />
      <UpdatesClient />
    </div>
  )
}

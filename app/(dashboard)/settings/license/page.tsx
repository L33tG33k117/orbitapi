import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { isSelfHost } from '@/lib/edition'
import { getLicenseState } from '@/lib/license-state'
import { licenseBanner } from '@/lib/license'
import { LicenseClient } from './license-client'

export const dynamic = 'force-dynamic'

export default async function LicensePage() {
  // Cloud plans come from billing; a licence has no meaning there.
  if (!isSelfHost()) redirect('/settings/billing')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user!.id).single()
  if (!membership || membership.role === 'member') redirect('/dashboard')

  const state = await getLicenseState()

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Licence"
        description="What this installation is licensed for, and how to renew it."
      />
      <LicenseClient
        initial={{
          status: state.status,
          customer: state.payload?.customer ?? null,
          tier: state.payload?.tier ?? null,
          seats: state.payload?.limits?.seats ?? null,
          expiresAt: state.payload ? new Date(state.payload.exp * 1000).toISOString() : null,
          daysRemaining: state.daysRemaining,
          message: state.message,
          banner: licenseBanner(state),
        }}
      />
    </div>
  )
}

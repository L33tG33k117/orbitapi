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

  // Check-in settings live on the single instance_settings row. Absent before
  // migration 057, in which case the panel simply doesn't render.
  let checkin: { enabled: boolean; lastAt: string | null; status: string | null; latestVersion: string | null } | undefined
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await createAdminClient()
      .from('instance_settings')
      .select('checkin_enabled, last_checkin_at, checkin_status, latest_version')
      .eq('id', 1)
      .maybeSingle()
    if (data) {
      checkin = {
        enabled: data.checkin_enabled !== false,
        lastAt: data.last_checkin_at ?? null,
        status: data.checkin_status ?? null,
        latestVersion: data.latest_version ?? null,
      }
    }
  } catch { /* pre-057 */ }

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
          checkin,
        }}
      />
    </div>
  )
}

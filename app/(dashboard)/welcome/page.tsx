import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetupWizard } from './setup-wizard'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user!.id).single()

  // No workspace yet → finish workspace creation first.
  if (!membership) redirect('/onboarding')
  // Members can't create connections/skills; the wizard is an admin/owner flow.
  if (membership.role === 'member') redirect('/dashboard')

  return <SetupWizard />
}

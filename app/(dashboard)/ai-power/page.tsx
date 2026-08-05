import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAiPower, TOPUP_PACKS, EFFICIENCY_INFO, EFFICIENCY_ORDER, type Efficiency } from '@/lib/ai-power'
import { AiPowerClient } from './ai-power-client'
import { PageHero } from '@/components/page-hero'
import { AdminsOnly } from '@/components/admins-only'

// Customer-facing AI Power — credits + efficiency. No dollars, tokens, models, or vendor.
export default async function AiPowerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')
  if (membership.role === 'member') {
    return (
      <AdminsOnly
        workspaceId={membership.workspace_id}
        eyebrow="Insights"
        title="AI Power"
        description="This is where admins see how much AI Power the workspace has left, set how much horsepower skills use, and top up the monthly pool."
      />
    )
  }

  const power = await getAiPower(membership.workspace_id)
  const admin = createAdminClient()
  const { data: skills } = await admin
    .from('skills').select('id, name, ai_efficiency').eq('workspace_id', membership.workspace_id).order('name')

  // On a self-hosted install nothing is metered — the model runs on the
  // customer's own hardware. The page becomes "here's what your AI has been
  // doing", with no allowance, no countdown and nothing to buy.
  const unmetered = !!power.unmetered

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHero
        eyebrow="Insights"
        title={unmetered ? 'AI Usage' : 'AI Power'}
        description={unmetered
          ? 'How much your assistant, skills, and playbooks have been using. Your AI runs on your own hardware, so there is no allowance to track and nothing to top up.'
          : 'Your plan includes a monthly pool of AI Power that every assistant, skill, and playbook draws from. Choose how much horsepower they use, and top up anytime.'}
      />
      <AiPowerClient
        power={power}
        tier={power.tier}
        unmetered={unmetered}
        // Nothing to sell on an air-gapped box; the top-up UI would 404.
        packs={unmetered ? [] : TOPUP_PACKS}
        efficiencyInfo={EFFICIENCY_INFO}
        efficiencyOrder={EFFICIENCY_ORDER}
        skills={(skills ?? []).map(s => ({ id: s.id, name: s.name, efficiency: (s.ai_efficiency ?? null) as Efficiency | null }))}
      />
    </div>
  )
}

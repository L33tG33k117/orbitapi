import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability, requiredTierFor } from '@/lib/entitlements'
import { FeatureGate } from '@/components/feature-gate'
import { ChatUI } from './chat-ui'

export default async function ChatPage() {
  const [supabase, features] = await Promise.all([
    createClient(),
    getWorkspaceFeatures(),
  ])
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user!.id).single()

  if (features && !hasCapability(features.tier, features.flags, 'ai_chat')) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-8 py-5 border-b shrink-0">
          <h1 className="text-2xl font-bold">Orbit Assistant</h1>
        </div>
        <FeatureGate
          feature="AI Chat Assistant"
          description="Talk to your APIs in plain English, chain actions across API connectors, and get AI-powered insights — all through a conversational interface."
          currentTier={features.tier}
          requiredTier={requiredTierFor('ai_chat')}
        />
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: skills } = membership
    ? await admin
        .from('skills')
        .select('id, name, description, autonomy, group:groups(name, color)')
        .eq('workspace_id', membership.workspace_id)
        .order('name')
    : { data: [] }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b shrink-0">
        <h1 className="text-2xl font-bold">Orbit Assistant</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Talk to your connected APIs in plain English
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatUI
          skills={(skills ?? []) as unknown as {
            id: string; name: string; description: string | null;
            autonomy: string;
            group: { name: string; color: string } | null
          }[]}
        />
      </div>
    </div>
  )
}

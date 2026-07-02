import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability, requiredTierFor } from '@/lib/entitlements'
import { FeatureGate } from '@/components/feature-gate'
import { CONNECTOR_EXAMPLES } from '@/lib/connector-examples'
import { getAiPower } from '@/lib/ai-power'
import { Sparkles } from 'lucide-react'
import { ChatUI } from './chat-ui'

// Build up to 6 starter prompts from the connectors the workspace actually has,
// so an empty chat suggests things the assistant can really do. One phrase per
// connector first (for variety), then a second pass if we still have room.
function buildConnectorSuggestions(slugs: string[]): string[] {
  const known = slugs.filter(s => CONNECTOR_EXAMPLES[s]?.chatPhrases?.length)
  const out: string[] = []
  for (let round = 0; round < 2 && out.length < 6; round++) {
    for (const slug of known) {
      const phrase = CONNECTOR_EXAMPLES[slug].chatPhrases[round]
      if (phrase && !out.includes(phrase)) out.push(phrase)
      if (out.length >= 6) break
    }
  }
  return out.slice(0, 6)
}

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
  const [{ data: skills }, { data: connections }] = membership
    ? await Promise.all([
        admin
          .from('skills')
          .select('id, name, description, autonomy, group:groups(name, color)')
          .eq('workspace_id', membership.workspace_id)
          .order('name'),
        admin
          .from('connections')
          .select('connector:connectors(slug)')
          .eq('workspace_id', membership.workspace_id)
          .neq('status', 'trashed'),
      ])
    : [{ data: [] }, { data: [] }]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectedSlugs = Array.from(new Set((connections ?? []).map((c: any) => c.connector?.slug).filter(Boolean)))
  const connectorSuggestions = buildConnectorSuggestions(connectedSlugs as string[])

  const power = membership ? await getAiPower(membership.workspace_id) : null
  const aiPower = {
    remaining: power?.remaining ?? 0,
    allowance: power?.allowance ?? 0,
    pctUsed: power?.pctUsed ?? 0,
    resetInDays: power?.resetInDays ?? 0,
    isTrial: power?.isTrial ?? true,
    tier: power?.tier ?? 'free',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Slim deep-space strip — the chat itself keeps the vertical space */}
      <div className="deep-space-panel flex items-center gap-3 px-4 sm:px-8 py-3.5 border-b border-white/10 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] shadow-[0_4px_16px_-4px_var(--brand-to)] shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Orbit Assistant</h1>
          <p className="text-white/50 text-xs truncate">Talk to your connected APIs in plain English</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatUI
          skills={(skills ?? []) as unknown as {
            id: string; name: string; description: string | null;
            autonomy: string;
            group: { name: string; color: string } | null
          }[]}
          hasConnections={connectedSlugs.length > 0}
          connectorSuggestions={connectorSuggestions}
          aiPower={aiPower}
        />
      </div>
    </div>
  )
}

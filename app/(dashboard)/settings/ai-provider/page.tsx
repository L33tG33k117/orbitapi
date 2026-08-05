import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { isSelfHost } from '@/lib/edition'
import { hasCapability, type FeatureOverrides } from '@/lib/entitlements'
import { AiProviderForm } from './ai-provider-form'
import type { WorkspaceTier } from '@/types'

export default async function AiProviderSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user!.id)
    .single()

  if (!membership || membership.role === 'member') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: ws } = await admin
    .from('workspaces').select('tier, feature_flags').eq('id', membership.workspace_id).maybeSingle()

  const entitled = isSelfHost() || hasCapability(
    (ws?.tier ?? null) as WorkspaceTier | null,
    (ws?.feature_flags ?? null) as FeatureOverrides | null,
    'byo_llm',
  )

  const { data: row } = await admin
    .from('ai_provider_settings')
    .select('base_url, model_name, max_output_tokens, enabled, api_key_secret_id')
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle()

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="AI Provider"
        description="Choose which AI model powers Orbit's assistant, skills, and playbooks."
      />
      <AiProviderForm
        entitled={entitled}
        initial={row ? {
          baseUrl: row.base_url,
          modelName: row.model_name,
          maxOutputTokens: row.max_output_tokens,
          enabled: row.enabled,
          hasApiKey: !!row.api_key_secret_id,
        } : null}
      />
    </div>
  )
}

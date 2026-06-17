import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags, type WorkspaceTier } from '@/types'
import { hasCapability, requiredTierFor, CAPABILITY_INFO, type Capability } from '@/lib/entitlements'

export interface WorkspaceFeatures {
  workspaceId: string
  tier: WorkspaceTier
  flags: FeatureFlags
}

export async function getWorkspaceFeatures(): Promise<WorkspaceFeatures | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()
  if (!membership) return null

  const admin = createAdminClient()
  const { data: workspace } = await admin
    .from('workspaces')
    .select('tier, feature_flags')
    .eq('id', membership.workspace_id)
    .single()

  return {
    workspaceId: membership.workspace_id,
    tier: (workspace?.tier ?? 'free') as WorkspaceTier,
    flags: (workspace?.feature_flags ?? DEFAULT_FEATURE_FLAGS) as FeatureFlags,
  }
}

// Server-side capability check for API routes / server components.
// Returns whether the current workspace can use a capability, plus the
// resolved features (null when there's no authenticated workspace).
export async function checkCapability(
  cap: Capability,
): Promise<{ allowed: boolean; features: WorkspaceFeatures | null }> {
  const features = await getWorkspaceFeatures()
  if (!features) return { allowed: false, features: null }
  return { allowed: hasCapability(features.tier, features.flags, cap), features }
}

// API-route guard: returns a 403 response when the capability is unavailable,
// or null when the route may proceed. Usage:
//   const denied = await capabilityGuard('webhooks'); if (denied) return denied
export async function capabilityGuard(cap: Capability): Promise<NextResponse | null> {
  const { allowed } = await checkCapability(cap)
  if (allowed) return null
  return NextResponse.json(
    {
      error: 'plan_required',
      message: `${CAPABILITY_INFO[cap].label} is available on a higher plan. Upgrade to unlock it.`,
      requiredTier: requiredTierFor(cap),
    },
    { status: 403 },
  )
}

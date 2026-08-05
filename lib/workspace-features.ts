import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags, type WorkspaceTier } from '@/types'
import { hasCapability, requiredTierFor, CAPABILITY_INFO, type Capability } from '@/lib/entitlements'
import { isSelfHost } from '@/lib/edition'
import { getLicenseState } from '@/lib/license-state'
import { licenseEntitlements } from '@/lib/license'

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

  // A self-hosted install has no plans, no Stripe, and nothing to upgrade to.
  // Its tier comes from the LICENCE instead of the workspace row — which is
  // why lib/entitlements.ts needed no changes at all: hasCapability() is pure,
  // so swapping where the tier comes from leaves capabilityGuard, page-gate
  // and the sidebar working untouched.
  //
  // An unlicensed or lapsed instance falls to a free-like floor rather than
  // refusing to run, and byo_llm stays on regardless — without it a
  // self-hosted box could not run any AI at all, which would make an expired
  // licence indistinguishable from a broken install.
  if (isSelfHost()) {
    const license = await getLicenseState()
    const { tier, overrides } = licenseEntitlements(license)
    return {
      workspaceId: membership.workspace_id,
      tier,
      flags: {
        ...DEFAULT_FEATURE_FLAGS,
        ...((workspace?.feature_flags ?? {}) as FeatureFlags),
        ...overrides,
        byo_llm: true,
      } as FeatureFlags,
    }
  }

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

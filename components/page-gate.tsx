import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { hasCapability, requiredTierFor, CAPABILITY_INFO, type Capability } from '@/lib/entitlements'
import { FeatureGate } from '@/components/feature-gate'

// Server helper for gated pages. Returns a FeatureGate element to render when
// the workspace lacks the capability, or null to let the page proceed.
// Usage at the top of a server page:
//   const gate = await pageGate('webhooks'); if (gate) return gate
export async function pageGate(cap: Capability) {
  const f = await getWorkspaceFeatures()
  if (!f || hasCapability(f.tier, f.flags, cap)) return null
  return (
    <FeatureGate
      feature={CAPABILITY_INFO[cap].label}
      description={CAPABILITY_INFO[cap].description}
      currentTier={f.tier}
      requiredTier={requiredTierFor(cap)}
    />
  )
}

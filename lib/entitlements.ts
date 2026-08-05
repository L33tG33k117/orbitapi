import type { WorkspaceTier } from '@/types'

// ============================================================
// Entitlements — what each plan tier can DO
// ============================================================
// Single source of truth for feature gating. A capability is available
// to a workspace if its TIER grants it by default, unless an explicit
// per-workspace override (feature_flags) grants or revokes it.
//
//   effective = override ?? tierDefault
//
// Free is deliberately limited: it's a taste of the assistant + basic
// connectors. The "builder" surfaces (skills, playbooks, webhooks, data
// mapping, discovery, API reference, exports) are paid — this is both the
// upgrade lever AND the IP safeguard (free users can't read the recipes).
// ============================================================

export type Capability =
  | 'ai_chat'              // Orbit Assistant (chat) — the hook, all tiers
  | 'connectors'           // connect/use basic API connectors — all tiers
  | 'groups'               // connector groups — all tiers
  | 'advanced_connectors'  // premium/enterprise connectors
  | 'skills'               // create & manually run skills (free gets a taste)
  | 'skill_automation'     // schedule skills + Supervised/Autonomous modes (paid)
  | 'playbooks'            // autonomous multi-step playbooks
  | 'data_mapping'         // cross-connector field mapping
  | 'bundles'              // install vertical bundles
  | 'bundle_export'        // export your own workspace as a bundle
  | 'discover'             // connector/schema discovery
  | 'webhooks'             // inbound webhook triggers
  | 'api_reference'        // full API action reference
  // Bring-your-own LLM: point Orbit at a local/self-run model instead of Claude.
  // Granted by NO tier — it exists for the self-hosted edition, where the
  // license grants it. Listing it here anyway (rather than branching on
  // edition) means support can still flip it per-workspace through the
  // existing feature_flags override if a cloud enterprise customer demands it,
  // with zero new admin surface.
  | 'byo_llm'

// Capabilities NOT in this list (dashboard, guide, usage, ai-power, audit,
// approvals, settings) are never gated — every tier can see them.

const TIER_ORDER: WorkspaceTier[] = ['free', 'starter', 'pro', 'enterprise']

// Capabilities granted by default at each tier (cumulative is expressed
// explicitly per tier so the table reads as a spec).
export const TIER_CAPABILITIES: Record<WorkspaceTier, Capability[]> = {
  // Free can create & manually run ONE skill (a taste of automation), but not
  // schedule it or make it autonomous (skill_automation) — that's the upgrade hook.
  free: ['ai_chat', 'connectors', 'groups', 'skills'],
  starter: ['ai_chat', 'connectors', 'groups', 'skills', 'skill_automation', 'bundles', 'data_mapping'],
  pro: [
    'ai_chat', 'connectors', 'groups', 'skills', 'skill_automation', 'bundles', 'data_mapping',
    'playbooks', 'webhooks', 'discover', 'api_reference', 'advanced_connectors', 'bundle_export',
  ],
  enterprise: [
    'ai_chat', 'connectors', 'groups', 'skills', 'skill_automation', 'bundles', 'data_mapping',
    'playbooks', 'webhooks', 'discover', 'api_reference', 'advanced_connectors', 'bundle_export',
  ],
}

// How many skills a tier may create. Free gets a single taste; paid is unlimited.
export const FREE_SKILL_LIMIT = 1
export function skillLimit(tier: WorkspaceTier | null | undefined): number {
  return (tier ?? 'free') === 'free' ? FREE_SKILL_LIMIT : Infinity
}

// How many REAL (non-simulated) connectors a tier may connect. Free = 3;
// paid is unlimited. Simulated/demo connectors never count and are always allowed.
export const FREE_CONNECTOR_LIMIT = 3
export function connectorLimit(tier: WorkspaceTier | null | undefined): number {
  return (tier ?? 'free') === 'free' ? FREE_CONNECTOR_LIMIT : Infinity
}

// Per-workspace overrides stored in workspaces.feature_flags (jsonb).
// A key set to `true` grants the capability regardless of tier; `false`
// revokes it. Absent keys fall back to the tier default.
export type FeatureOverrides = Partial<Record<Capability, boolean>>

export function hasCapability(
  tier: WorkspaceTier | null | undefined,
  overrides: FeatureOverrides | null | undefined,
  cap: Capability,
): boolean {
  const o = overrides?.[cap]
  if (typeof o === 'boolean') return o
  const t = (tier ?? 'free') as WorkspaceTier
  return (TIER_CAPABILITIES[t] ?? TIER_CAPABILITIES.free).includes(cap)
}

// The lowest tier that grants a capability by default — used to tell the
// user what to upgrade to ("Available on Pro").
export function requiredTierFor(cap: Capability): WorkspaceTier {
  for (const t of TIER_ORDER) {
    if (TIER_CAPABILITIES[t].includes(cap)) return t
  }
  return 'enterprise'
}

// Human copy for the gate screens (no model/vendor names; non-technical).
export const CAPABILITY_INFO: Record<Capability, { label: string; description: string }> = {
  ai_chat: { label: 'Orbit Assistant', description: 'Chat in plain English to run your connected apps.' },
  connectors: { label: 'API Connectors', description: 'Connect and run the apps your team already uses.' },
  groups: { label: 'Groups', description: 'Organize connectors into reusable groups.' },
  advanced_connectors: { label: 'Advanced Connectors', description: 'Premium and enterprise-grade connectors.' },
  skills: { label: 'Skills', description: 'Save reusable, automated tasks the assistant can run for you.' },
  skill_automation: { label: 'Scheduling & Autonomy', description: 'Run skills on a schedule or fully autonomously, hands-free.' },
  playbooks: { label: 'Playbooks', description: 'Autonomous, multi-step workflows that act and escalate on their own.' },
  data_mapping: { label: 'Data Mapping', description: 'Map fields between apps so data flows automatically.' },
  bundles: { label: 'Bundles', description: 'Install ready-made packs of connectors, skills, and playbooks.' },
  bundle_export: { label: 'Bundle Export', description: 'Package your own setup as a shareable bundle.' },
  discover: { label: 'Discover', description: 'Explore and auto-discover what an API can do.' },
  webhooks: { label: 'Webhooks', description: 'Trigger automations from external events in real time.' },
  api_reference: { label: 'Connector Actions', description: 'Search and run actions across all your connected apps in one place.' },
  byo_llm: { label: 'Your Own AI Model', description: 'Point Orbit at an AI model you run yourself, so your data never leaves your network.' },
}

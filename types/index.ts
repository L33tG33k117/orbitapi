export type UserRole = 'owner' | 'admin' | 'member'
export type ConnectionLevel = 'read' | 'read_write'
export type ActionRisk = 'read' | 'write' | 'destructive'
export type PendingActionStatus = 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executed' | 'failed'
export type AutomationStatus = 'running' | 'success' | 'failed' | 'skipped'
export type WorkspaceTier = 'free' | 'starter' | 'pro' | 'enterprise'

// Per-workspace capability overrides (see lib/entitlements.ts). A key set to
// true grants that capability regardless of tier; false revokes it. Absent
// keys fall back to the tier default. Empty {} = pure tier defaults.
export type FeatureFlags = Record<string, boolean>

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {}

export interface Workspace {
  id: string
  name: string
  tier: WorkspaceTier
  feature_flags: FeatureFlags
  created_at: string
}

export interface Membership {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  super_admin: boolean
}

export type UserRole = 'owner' | 'admin' | 'member'
export type ConnectionLevel = 'read' | 'read_write'
export type ActionRisk = 'read' | 'write' | 'destructive'
export type PendingActionStatus = 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executed' | 'failed'
export type AutomationStatus = 'running' | 'success' | 'failed' | 'skipped'

export interface Workspace {
  id: string
  name: string
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
}

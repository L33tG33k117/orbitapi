'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronDown, ChevronRight, Trash2, PauseCircle, PlayCircle, Crown, ShieldCheck, User } from 'lucide-react'

interface CustomRole {
  id: string
  name: string
}

interface Member {
  id: string
  user_id: string
  role: UserRole
  suspended_at: string | null
  suspension_reason: string | null
  custom_role_id: string | null
  profile: { email: string; full_name: string | null } | null
}

interface Connection {
  id: string
  label: string
  connector: { name: string } | null
}

interface Grant {
  user_id: string
  connection_id: string
  level: string
}

interface MemberListProps {
  members: Member[]
  currentUserId: string
  currentRole: UserRole
  workspaceId: string
  connections: Connection[]
  grants: Grant[]
  customRoles: CustomRole[]
}

function roleDisplayName(role: UserRole, customRoleId: string | null, customRoles: CustomRole[]) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Administrator'
  if (role === 'member') {
    if (customRoleId) {
      const cr = customRoles.find(r => r.id === customRoleId)
      return cr?.name ?? 'User'
    }
    return 'User'
  }
  return role
}

function RoleIcon({ role }: { role: UserRole }) {
  if (role === 'owner') return <Crown className="h-3 w-3 text-amber-400" />
  if (role === 'admin') return <ShieldCheck className="h-3 w-3 text-primary" />
  return <User className="h-3 w-3 text-muted-foreground" />
}

function GrantRow({ conn, currentLevel, onSave }: {
  conn: Connection
  currentLevel: string | undefined
  onSave: (level: 'none' | 'read' | 'read_write') => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  async function handleChange(level: string) {
    setSaving(true)
    await onSave(level as 'none' | 'read' | 'read_write')
    setSaving(false)
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground min-w-0 truncate flex-1">
        {conn.label}
        {conn.connector && <span className="opacity-50"> · {conn.connector.name}</span>}
      </span>
      <select
        value={currentLevel ?? 'none'}
        disabled={saving}
        onChange={e => handleChange(e.target.value)}
        className="h-6 rounded border border-input bg-background px-1.5 text-xs disabled:opacity-50 shrink-0"
      >
        <option value="none">No access</option>
        <option value="read">Read</option>
        <option value="read_write">Read+Write</option>
      </select>
    </div>
  )
}

export function MemberList({
  members, currentUserId, currentRole, workspaceId, connections, grants, customRoles,
}: MemberListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [suspending, setSuspending] = useState<string | null>(null)

  const grantMap: Record<string, Record<string, string>> = {}
  for (const g of grants) {
    if (!grantMap[g.user_id]) grantMap[g.user_id] = {}
    grantMap[g.user_id][g.connection_id] = g.level
  }

  const canManageRoles = currentRole === 'owner'
  const canSuspend = currentRole === 'owner' || currentRole === 'admin'

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the workspace?`)) return
    await fetch(`/api/workspaces/members/${userId}?workspaceId=${workspaceId}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  async function handleRoleChange(userId: string, newRole: UserRole, customRoleId?: string | null) {
    await fetch(`/api/workspaces/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, role: newRole, customRoleId: customRoleId ?? null }),
    })
    startTransition(() => router.refresh())
  }

  async function handleSuspend(userId: string, suspend: boolean) {
    setSuspending(userId)
    let reason: string | undefined
    if (suspend) {
      const r = prompt('Reason for suspension (optional):')
      if (r === null) { setSuspending(null); return }
      reason = r || undefined
    }
    await fetch(`/api/workspaces/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, suspend, suspensionReason: reason }),
    })
    setSuspending(null)
    startTransition(() => router.refresh())
  }

  async function handleGrantChange(userId: string, connectionId: string, level: 'none' | 'read' | 'read_write') {
    if (level === 'none') {
      await fetch(`/api/connections/${connectionId}/grants/${userId}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/connections/${connectionId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, level }),
      })
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr,160px,100px,auto] items-center px-4 py-2.5 bg-muted/30 border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Member</span>
        <span>Role</span>
        <span>Status</span>
        <span className="text-right pr-1">Actions</span>
      </div>

      {/* Member rows */}
      <div className="divide-y divide-border/50">
        {members.map(m => {
          const name = m.profile?.full_name ?? m.profile?.email ?? 'Unknown'
          const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          const isMe = m.user_id === currentUserId
          const isSuspended = !!m.suspended_at
          const canEdit = canManageRoles && m.role !== 'owner' && !isMe
          const canEditGrants = canSuspend && m.role === 'member'
          const isExpanded = expanded === m.user_id
          const memberGrants = grantMap[m.user_id] ?? {}
          const displayName = roleDisplayName(m.role, m.custom_role_id, customRoles)

          return (
            <div key={m.id} className={isSuspended ? 'opacity-60' : ''}>
              <div className="grid grid-cols-[1fr,160px,100px,auto] items-center px-4 py-3 gap-2">
                {/* Name + email */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={`text-xs font-semibold ${
                      m.role === 'owner' ? 'bg-amber-500/20 text-amber-500' :
                      m.role === 'admin' ? 'bg-primary/15 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {name}{isMe && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(you)</span>}
                    </p>
                    {m.profile?.full_name && (
                      <p className="text-xs text-muted-foreground truncate">{m.profile.email}</p>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div>
                  {canEdit ? (
                    <select
                      defaultValue={`${m.role}::${m.custom_role_id ?? ''}`}
                      onChange={e => {
                        const [role, crId] = e.target.value.split('::')
                        handleRoleChange(m.user_id, role as UserRole, crId || null)
                      }}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs w-full max-w-[150px]"
                    >
                      <option value="admin::">Administrator</option>
                      <option value="member::">User</option>
                      {customRoles.map(cr => (
                        <option key={cr.id} value={`member::${cr.id}`}>{cr.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <RoleIcon role={m.role} />
                      <span className="text-xs font-medium">{displayName}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  {isSuspended ? (
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/5">
                      Suspended
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/5">
                      Active
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {canEditGrants && connections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : m.user_id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                    >
                      Access
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  {canSuspend && m.role !== 'owner' && !isMe && (
                    <button
                      type="button"
                      disabled={suspending === m.user_id}
                      onClick={() => handleSuspend(m.user_id, !isSuspended)}
                      className={`p-1.5 rounded transition-colors hover:bg-muted disabled:opacity-50 ${
                        isSuspended ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'
                      }`}
                      title={isSuspended ? 'Reinstate access' : 'Suspend access'}
                    >
                      {isSuspended ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.user_id, name)}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Suspended reason */}
              {isSuspended && m.suspension_reason && (
                <div className="px-4 pb-2">
                  <p className="text-[11px] text-muted-foreground ml-11">Reason: {m.suspension_reason}</p>
                </div>
              )}

              {/* Expanded API grants */}
              {isExpanded && m.role === 'member' && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">API access</p>
                  {connections.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active connections in this workspace.</p>
                  ) : (
                    connections.map(conn => (
                      <GrantRow
                        key={conn.id}
                        conn={conn}
                        currentLevel={memberGrants[conn.id]}
                        onSave={level => handleGrantChange(m.user_id, conn.id, level)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

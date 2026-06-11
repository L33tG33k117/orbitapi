'use client'

import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface Member {
  id: string
  user_id: string
  role: UserRole
  profile: { email: string; full_name: string | null } | null
}

interface MemberListProps {
  members: Member[]
  currentUserId: string
  currentRole: UserRole
  workspaceId: string
}

const roleColors: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

export function MemberList({ members, currentUserId, currentRole, workspaceId }: MemberListProps) {
  const router = useRouter()

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    await fetch(`/api/workspaces/members/${userId}?workspaceId=${workspaceId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await fetch(`/api/workspaces/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, role: newRole }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {members.map(m => {
        const name = m.profile?.full_name ?? m.profile?.email ?? 'Unknown'
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        const isMe = m.user_id === currentUserId
        const canEdit = currentRole === 'owner' && m.role !== 'owner' && !isMe

        return (
          <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{name}{isMe && ' (you)'}</p>
              {m.profile?.full_name && <p className="text-xs text-muted-foreground truncate">{m.profile.email}</p>}
            </div>
            <Badge variant={roleColors[m.role]}>{m.role}</Badge>
            {canEdit && (
              <>
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.user_id, e.target.value as UserRole)}
                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                <Button variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={() => handleRemove(m.user_id)}>
                  Remove
                </Button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

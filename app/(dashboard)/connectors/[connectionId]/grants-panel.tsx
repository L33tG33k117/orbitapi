'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface Member {
  user_id: string
  role: string
  profile: { email: string; full_name: string | null } | null
}

interface Grant {
  user_id: string
  level: 'read' | 'read_write'
}

interface GrantsPanelProps {
  connectionId: string
  initialMembers: Member[]
  initialGrants: Grant[]
}

export function GrantsPanel({ connectionId, initialMembers, initialGrants }: GrantsPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)

  const grantMap: Record<string, 'read' | 'read_write' | undefined> = Object.fromEntries(
    initialGrants.map(g => [g.user_id, g.level])
  )

  async function setLevel(userId: string, level: 'none' | 'read' | 'read_write') {
    setSaving(userId)
    try {
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
    } finally {
      setSaving(null)
    }
  }

  if (initialMembers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No members in this workspace. Invite members from{' '}
        <a href="/settings/members" className="underline">Settings → Members</a>.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {initialMembers.map(m => {
        const name = m.profile?.full_name ?? m.profile?.email ?? 'Unknown'
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        const currentLevel: 'none' | 'read' | 'read_write' = grantMap[m.user_id] ?? 'none'
        const isSaving = saving === m.user_id || pending

        return (
          <div key={m.user_id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{name}</p>
              {m.profile?.full_name && (
                <p className="text-xs text-muted-foreground truncate">{m.profile.email}</p>
              )}
            </div>
            <Badge
              variant={currentLevel === 'none' ? 'outline' : currentLevel === 'read' ? 'secondary' : 'default'}
              className="text-xs shrink-0"
            >
              {currentLevel === 'none' ? 'No access' : currentLevel === 'read' ? 'Read' : 'Read+Write'}
            </Badge>
            <select
              value={currentLevel}
              disabled={isSaving}
              onChange={e => setLevel(m.user_id, e.target.value as 'none' | 'read' | 'read_write')}
              className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
            >
              <option value="none">No access</option>
              <option value="read">Read only</option>
              <option value="read_write">Read + Write</option>
            </select>
          </div>
        )
      })}
    </div>
  )
}

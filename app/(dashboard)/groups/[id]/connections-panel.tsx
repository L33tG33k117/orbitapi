'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Connection {
  id: string
  label: string
  connector: { slug: string; name: string } | null
}

interface ConnectionsPanelProps {
  groupId: string
  allConnections: Connection[]
  inGroupIds: string[]
  isAdmin: boolean
}

export function ConnectionsPanel({ groupId, allConnections, inGroupIds, isAdmin }: ConnectionsPanelProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)

  const inGroup = new Set(inGroupIds)

  async function toggle(connectionId: string, currentlyIn: boolean) {
    setSaving(connectionId)
    try {
      if (currentlyIn) {
        await fetch(`/api/groups/${groupId}/connections/${connectionId}`, { method: 'DELETE' })
      } else {
        await fetch(`/api/groups/${groupId}/connections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId }),
        })
      }
      startTransition(() => router.refresh())
    } finally {
      setSaving(null)
    }
  }

  if (allConnections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
        No active connections in your workspace.
      </p>
    )
  }

  return (
    <div className="border rounded-lg divide-y">
      {allConnections.map(conn => {
        const isIn = inGroup.has(conn.id)
        const isSaving = saving === conn.id

        return (
          <div key={conn.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{conn.label}</p>
              {conn.connector && (
                <p className="text-xs text-muted-foreground">{conn.connector.name}</p>
              )}
            </div>
            {isAdmin ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => toggle(conn.id, isIn)}
                className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                  isIn ? 'bg-primary' : 'bg-muted border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isIn ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            ) : (
              <span className={`text-xs font-medium ${isIn ? 'text-primary' : 'text-muted-foreground'}`}>
                {isIn ? 'Included' : 'Not included'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

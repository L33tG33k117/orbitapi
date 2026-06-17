'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function GroupDeleteButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete group "${groupName}"? Skills attached to this group will be unlinked.`)) return
    setLoading(true)
    await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 shrink-0"
      title="Delete group"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

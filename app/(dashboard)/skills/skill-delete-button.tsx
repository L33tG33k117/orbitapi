'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function SkillDeleteButton({ skillId, skillName }: { skillId: string; skillName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete skill "${skillName}"? This cannot be undone.`)) return
    setLoading(true)
    await fetch(`/api/skills/${skillId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 shrink-0"
      title="Delete skill"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

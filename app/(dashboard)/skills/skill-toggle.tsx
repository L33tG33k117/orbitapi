'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SkillToggle({ skillId, enabled }: { skillId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    const next = !on
    setOn(next) // optimistic
    setLoading(true)
    const res = await fetch(`/api/skills/${skillId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    setLoading(false)
    if (!res.ok) {
      setOn(!next) // revert on failure
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      role="switch"
      aria-checked={on}
      title={on ? 'Disable skill' : 'Enable skill'}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-green-500' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

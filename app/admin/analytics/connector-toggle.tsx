'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ConnectorToggle({ slug, name, disabled }: { slug: string; name: string; disabled: boolean }) {
  const [optimistic, setOptimistic] = useState(disabled)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function toggle() {
    const next = !optimistic
    setOptimistic(next)
    let reason: string | undefined
    if (next) {
      const r = prompt(`Reason for disabling ${name}? (optional)`)
      if (r === null) { setOptimistic(optimistic); return }
      reason = r || undefined
    }
    const res = await fetch(`/api/admin/connectors/${slug}/disable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: next, reason }),
    })
    if (!res.ok) { setOptimistic(optimistic); return }
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
        optimistic
          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
      }`}
    >
      {optimistic ? 'Disabled' : 'Active'}
    </button>
  )
}

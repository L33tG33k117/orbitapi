'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play } from 'lucide-react'

// Run a playbook from a list. Supervised-style safety lives in the playbook's
// own autonomy policy; here we run live and surface the result.
export function PlaybookRunButton({
  playbookId, enabled, afterRun = 'navigate',
}: {
  playbookId: string
  enabled: boolean
  afterRun?: 'navigate' | 'refresh'
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'live' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Run failed'); return }
      if (afterRun === 'refresh') {
        toast.success('Done — see the result below.')
        router.refresh()
      } else {
        toast.success('Done — opening the result…')
        router.push(`/playbooks/${playbookId}`)
        router.refresh()
      }
    } catch {
      toast.error('Run failed — check your connection and try again.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={running}
      title={enabled ? 'Run this playbook and see the result' : 'This playbook is turned off — turn it on to run'}
      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 transition-colors"
    >
      <Play className="h-3 w-3" /> {running ? 'Running…' : 'Run'}
    </button>
  )
}

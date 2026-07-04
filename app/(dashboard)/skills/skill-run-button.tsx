'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play } from 'lucide-react'

// Run a skill straight from the list, then jump to its result. Supervised skills
// run as a safe dry run; manual/autonomous run live.
export function SkillRunButton({
  skillId, autonomy, runnable,
}: {
  skillId: string
  autonomy: 'supervised' | 'manual' | 'autonomous'
  runnable: boolean
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const mode = autonomy === 'supervised' ? 'dry_run' : 'live'
  const label = autonomy === 'supervised' ? 'Test run' : 'Run'

  async function run() {
    if (!runnable) { toast.error('Give this skill a persona and verify it before running.'); return }
    setRunning(true)
    try {
      const res = await fetch(`/api/skills/${skillId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Run failed'); return }
      toast.success('Done — opening the result…')
      router.push(`/skills/${skillId}#run-history`)
      router.refresh()
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
      title={runnable ? 'Run this skill and see the result' : 'Give it a persona and verify it first'}
      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 transition-colors"
    >
      <Play className="h-3 w-3" /> {running ? 'Running…' : label}
    </button>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { trackLaunch } from '@/lib/launch-store'

// Run a skill from anywhere. Instead of dumping you into the skill's edit page,
// it registers a "launch" that shows live in the top-bar rocket tray — you watch
// it run there and click through to the result in Starlab when it's done.
export function SkillRunButton({
  skillId, skillName, autonomy, runnable,
}: {
  skillId: string
  skillName: string
  autonomy: 'supervised' | 'manual' | 'autonomous'
  runnable: boolean
}) {
  const router = useRouter()
  const mode = autonomy === 'supervised' ? 'dry_run' : 'live'

  async function run() {
    if (!runnable) {
      const { toast } = await import('sonner')
      toast.error('Give this skill a persona and verify it before running.')
      return
    }
    await trackLaunch({ name: skillName, kind: 'skill', href: '/starlab' }, async () => {
      const res = await fetch(`/api/skills/${skillId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
      })
      const d = await res.json().catch(() => ({}))
      return { ok: res.ok, error: d.error }
    })
    // Refresh so on-page result feeds (Starlab, skill page) pick up the new run.
    router.refresh()
  }

  return (
    <button
      onClick={run}
      title={runnable ? 'Run this skill — watch it in the launch tray' : 'Give it a persona and verify it first'}
      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
    >
      <Play className="h-3 w-3" /> Run
    </button>
  )
}

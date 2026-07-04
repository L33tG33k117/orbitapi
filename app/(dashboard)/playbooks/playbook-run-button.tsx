'use client'

import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { trackLaunch } from '@/lib/launch-store'
import { isNotSetUp, offerSimulateAndRerun } from '@/lib/not-set-up'

// Run a playbook from anywhere; progress shows in the top-bar launch tray, with
// a click-through to the result in Starlab — no jump to the edit page.
export function PlaybookRunButton({
  playbookId, playbookName, enabled,
}: {
  playbookId: string
  playbookName: string
  enabled: boolean
}) {
  const router = useRouter()

  async function run() {
    await trackLaunch({ name: playbookName, kind: 'playbook', href: '/starlab' }, async () => {
      const res = await fetch(`/api/playbooks/${playbookId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'live' }),
      })
      const d = await res.json().catch(() => ({}))
      // Refused before running: some apps were never set up. Offer to switch
      // them to Simulation and re-run — no "failed" rocket for this case.
      if (isNotSetUp(res.status, d)) {
        offerSimulateAndRerun({ name: playbookName, body: d, rerun: run })
        return { ok: false, discard: true }
      }
      return { ok: res.ok, error: d.error }
    })
    router.refresh()
  }

  return (
    <button
      onClick={run}
      title={enabled ? 'Run this playbook — watch it in the launch tray' : 'This playbook is turned off — turn it on to run'}
      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
    >
      <Play className="h-3 w-3" /> Run
    </button>
  )
}

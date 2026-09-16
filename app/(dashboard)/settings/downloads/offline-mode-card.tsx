'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, Cloud, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Offline and online are exclusive for a workspace. Switching explains the
// consequences up front, because both directions have one.
export function OfflineModeCard({ active, canManage, changedAt }: {
  active: boolean
  canManage: boolean
  changedAt: string | null
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const res = await fetch('/api/workspaces/offline-mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !active }),
    })
    const body = await res.json().catch(() => ({}))
    setSaving(false)
    setConfirming(false)
    if (!res.ok) { toast.error(body.message ?? body.error ?? 'Could not change offline mode'); return }
    toast.success(active ? 'Back online. Connections and automations are active here again.' : 'Offline mode is on.')
    router.refresh()
  }

  return (
    <section id="offline-mode" className="rounded-xl border bg-card p-5 space-y-3 scroll-mt-20">
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${active ? 'bg-amber-500/15 text-amber-500' : 'bg-primary/10 text-primary'}`}>
          {active ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">{active ? 'Offline mode is on' : 'Step 1: Switch this workspace to offline mode'}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active
              ? 'Your self-hosted install is the live one. Connections, automations and the assistant are paused in this cloud workspace so nothing is changed here by mistake.'
              : 'Before you install, switch this workspace to offline. You can run OrbitAPI online or offline, not both: while offline, this cloud workspace pauses its connections, automations and assistant, and keeps downloads, licence and updates available.'}
          </p>
          {active && changedAt && (
            <p className="text-[11px] text-muted-foreground mt-1">Since {new Date(changedAt).toLocaleString()}</p>
          )}
        </div>
      </div>

      {canManage ? (
        confirming ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-sm">
            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4 text-amber-500" /> Before you switch</p>
            {active ? (
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Connections, automations and schedules become active <span className="text-foreground">here in the cloud</span> again.</li>
                <li>Your self-hosted install is <span className="text-foreground">not</span> changed or stopped. If it keeps running too, the same schedules may run twice. Turn them off there first.</li>
                <li>Nothing syncs between the two. Changes made here won&apos;t reach the install, and the install won&apos;t receive new updates unless you come back here to download them.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Scheduled skills and playbooks stop running in the cloud, and the assistant, connectors and approvals are paused here.</li>
                <li>Your data here is kept. You can switch back at any time.</li>
                <li>Set up your connections again on the self-hosted install. Credentials are never copied out of the cloud.</li>
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={toggle} disabled={saving}>
                {saving ? 'Switching…' : active ? 'Switch back to online' : 'Switch to offline mode'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant={active ? 'outline' : 'default'} onClick={() => setConfirming(true)}>
            {active ? 'Switch back to online…' : 'Switch to offline mode…'}
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">Only a workspace owner or admin can change this.</p>
      )}
    </section>
  )
}

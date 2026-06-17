'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import type { ConnectorSummary } from '@/connectors/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  connector: ConnectorSummary
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function SimulateDialog({ connector, open, onOpenChange }: Props) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setLabel(''); setError(null); setLoading(false)
  }

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectorSlug: connector.slug,
        label: label.trim() || `${connector.name} (Simulated)`,
        credentials: { __simulated: 'true' },
        isSimulated: true,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create simulation')
      setLoading(false)
      return
    }

    onOpenChange(false)
    reset()
    router.push(`/connectors/${data.connection.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-400" />
            Simulate {connector.name}
          </DialogTitle>
          <DialogDescription>
            Run {connector.name} with realistic fake data — no API keys needed. You can convert
            to a real connection at any time and keep all your configurations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSimulate} className="space-y-4">
          <div className="rounded-lg bg-violet-500/8 border border-violet-500/20 p-3 space-y-1">
            <p className="text-xs font-semibold text-violet-300">What simulation does</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>All actions return realistic but fake data</li>
              <li>Write actions succeed without touching any real system</li>
              <li>Mix simulated and real connectors in the same workspace</li>
              <li>Convert to real anytime — skills and configs are preserved</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sim-label">Connection name</Label>
            <Input
              id="sim-label"
              placeholder={`${connector.name} (Simulated)`}
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Give it a name so you can identify it later</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full gap-2 bg-violet-600 hover:bg-violet-500 text-white">
            <FlaskConical className="h-4 w-4" />
            {loading ? 'Creating simulation…' : 'Start simulation'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

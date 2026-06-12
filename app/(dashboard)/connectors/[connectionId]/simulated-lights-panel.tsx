'use client'

import { useState, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Device {
  id: string
  device_name: string
  is_on: boolean
  brightness: number
  hex_color: string
  scene: string | null
}

async function executeAction(connectionId: string, slug: string, params: Record<string, unknown>) {
  const res = await fetch(`/api/connections/${connectionId}/actions/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return res.json()
}

export function SimulatedLightsPanel({ connectionId, initialDevices }: { connectionId: string; initialDevices: Device[] }) {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(device: Device) {
    setLoading(device.device_name)
    await executeAction(connectionId, 'set_power', { device_name: device.device_name, is_on: !device.is_on })
    setDevices(ds => ds.map(d => d.device_name === device.device_name ? { ...d, is_on: !d.is_on } : d))
    setLoading(null)
  }

  async function activateScene(scene: string) {
    setLoading(`scene-${scene}`)
    await executeAction(connectionId, 'set_scene', { device_name: 'all', scene })
    router.refresh()
    setLoading(null)
  }

  const scenes = ['Entry', 'Relax', 'Bright', 'Night', 'Off']

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Simulated Lights</h2>

      <div className="flex flex-wrap gap-2">
        {scenes.map(s => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            disabled={!!loading}
            onClick={() => activateScene(s)}
          >
            {loading === `scene-${s}` ? '…' : s}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {devices.map(d => (
          <div key={d.id} className="border rounded-lg p-4 flex items-center gap-4">
            <div
              className="h-8 w-8 rounded-full border shrink-0 transition-all"
              style={{ backgroundColor: d.is_on ? d.hex_color : '#374151', opacity: d.is_on ? d.brightness / 100 : 0.3 }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{d.device_name}</p>
              <p className="text-xs text-muted-foreground">
                {d.is_on ? `On · ${d.brightness}%` : 'Off'}
                {d.scene ? ` · ${d.scene}` : ''}
              </p>
            </div>
            <Button
              size="sm"
              variant={d.is_on ? 'default' : 'outline'}
              disabled={loading === d.device_name}
              onClick={() => toggle(d)}
            >
              {loading === d.device_name ? '…' : d.is_on ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        ))}
        {devices.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">No devices yet — they are created automatically when you connect.</p>
        )}
      </div>
    </section>
  )
}

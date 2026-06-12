'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Connection {
  id: string
  label: string
  status: string
  created_at: string
  connector: { slug: string; name: string; category: string; is_simulated: boolean } | null
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  error: 'bg-red-500',
  disconnected: 'bg-gray-400',
}

export function ConnectionList({ connections, canManage }: { connections: Connection[]; canManage: boolean }) {
  const router = useRouter()
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})

  async function handleTest(id: string) {
    setTesting(id)
    const res = await fetch(`/api/connections/${id}/test`, { method: 'POST' })
    const data = await res.json()
    setTestResults(r => ({ ...r, [id]: data }))
    setTesting(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Disconnect and remove this connection?')) return
    await fetch(`/api/connections/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {connections.map(c => (
        <div key={c.id} className="border rounded-lg p-4 flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full shrink-0 ${statusColors[c.status] ?? 'bg-gray-400'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{c.label}</p>
              {c.connector?.is_simulated && (
                <Badge variant="secondary" className="text-xs">Simulated</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{c.connector?.name} · {c.connector?.category}</p>
            {testResults[c.id] && (
              <p className={`text-xs mt-1 ${testResults[c.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                {testResults[c.id].ok ? '✓ Connected' : `✗ ${testResults[c.id].error}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/connectors/${c.id}`}>
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
            {canManage && (
              <>
                <Button variant="outline" size="sm" disabled={testing === c.id} onClick={() => handleTest(c.id)}>
                  {testing === c.id ? 'Testing…' : 'Test'}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(c.id)}>
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

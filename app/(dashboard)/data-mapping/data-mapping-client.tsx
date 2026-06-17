'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRight, Sparkles } from 'lucide-react'

interface Conn { id: string; label: string; reads: { slug: string; name: string }[]; writes: { slug: string; name: string }[] }
interface Mapping { target: string; source: string; note?: string }
interface Result { mappings?: Mapping[]; preview?: Record<string, unknown>; unmapped?: string[]; sample?: unknown }

export function DataMappingClient({ connections }: { connections: Conn[] }) {
  const [srcConn, setSrcConn] = useState('')
  const [srcAction, setSrcAction] = useState('')
  const [tgtConn, setTgtConn] = useState('')
  const [tgtAction, setTgtAction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const src = connections.find(c => c.id === srcConn)
  const tgt = connections.find(c => c.id === tgtConn)

  async function propose() {
    if (!srcConn || !srcAction || !tgtConn || !tgtAction) { toast.error('Pick source and target'); return }
    setLoading(true); setResult(null)
    const res = await fetch('/api/data-mapping/propose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceConnectionId: srcConn, sourceAction: srcAction, targetConnectionId: tgtConn, targetAction: tgtAction }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Mapping failed'); return }
    setResult(data)
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <Label>Source (read)</Label>
            <select value={srcConn} onChange={e => { setSrcConn(e.target.value); setSrcAction('') }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Connection…</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={srcAction} onChange={e => setSrcAction(e.target.value)} disabled={!src}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Read action…</option>
              {(src?.reads ?? []).map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Target (write)</Label>
            <select value={tgtConn} onChange={e => { setTgtConn(e.target.value); setTgtAction('') }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Connection…</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={tgtAction} onChange={e => setTgtAction(e.target.value)} disabled={!tgt}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Write action…</option>
              {(tgt?.writes ?? []).map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={propose} disabled={loading}><Sparkles className="h-3.5 w-3.5" /> {loading ? 'Mapping…' : 'Propose mapping'}</Button>
      </div>

      {result && (
        <div className="space-y-4">
          {result.unmapped && result.unmapped.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-500">
              Unmapped required fields: {result.unmapped.join(', ')}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold mb-2">Proposed field mappings</p>
            <div className="space-y-1">
              {(result.mappings ?? []).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs border rounded-lg px-3 py-2 bg-card">
                  <code className="font-mono text-muted-foreground">{m.source}</code>
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                  <code className="font-mono">{m.target}</code>
                  {m.note && <span className="ml-auto text-[10px] text-muted-foreground">{m.note}</span>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Transformed preview</p>
            <pre className="text-[11px] bg-muted/40 rounded-lg p-3 overflow-x-auto max-h-64">{JSON.stringify(result.preview, null, 2)}</pre>
            <p className="text-[11px] text-muted-foreground mt-1">
              This is a dry preview against one live record. Wire it into a playbook action step to automate the sync.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

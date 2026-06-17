'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Sparkles, Send } from 'lucide-react'

interface Action { slug: string; name: string; description: string; method: string; path: string; risk: string }
interface Result { validated: boolean; validation_message?: string; baseUrl?: string; actions?: Action[] }

const RISK_COLOR: Record<string, string> = {
  read: 'bg-muted text-muted-foreground', write: 'bg-amber-500/10 text-amber-500', destructive: 'bg-red-500/10 text-red-500',
}

export function DiscoverClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [openApiUrl, setOpenApiUrl] = useState('')
  const [authHint, setAuthHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function discover(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true); setResult(null)
    const res = await fetch('/api/connectors/discover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), baseUrl, openApiUrl, authHint }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Discovery failed'); return }
    setResult(data)
    if (!data.validated) toast.warning(data.validation_message ?? 'Could not confidently identify endpoints')
  }

  async function requestBuild() {
    if (!result?.actions) return
    const useCase = `AI-discovered connector. Proposed actions:\n` +
      result.actions.map(a => `- ${a.name} (${a.method} ${a.path}) [${a.risk}]`).join('\n')
    const res = await fetch('/api/connector-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connector_name: name.trim(), website_url: openApiUrl || baseUrl || null, use_case: useCase }),
    })
    if (res.ok) { toast.success('Connector request submitted'); router.push('/connectors/requests') }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Request failed') }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={discover} className="border rounded-xl p-4 bg-card space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="dname">API name</Label>
            <Input id="dname" value={name} onChange={e => setName(e.target.value)} placeholder="Acme CRM" required /></div>
          <div className="space-y-1.5"><Label htmlFor="dbase">Base URL</Label>
            <Input id="dbase" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.acme.com" /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="dspec">OpenAPI / Swagger URL (optional, improves accuracy)</Label>
          <Input id="dspec" value={openApiUrl} onChange={e => setOpenApiUrl(e.target.value)} placeholder="https://api.acme.com/openapi.json" /></div>
        <div className="space-y-1.5"><Label htmlFor="dauth">Auth hint (optional)</Label>
          <Input id="dauth" value={authHint} onChange={e => setAuthHint(e.target.value)} placeholder="Bearer token in Authorization header" /></div>
        <Button type="submit" disabled={loading || !name.trim()}>
          <Sparkles className="h-3.5 w-3.5" /> {loading ? 'Introspecting…' : 'Discover schema'}
        </Button>
      </form>

      {result && (
        <div className="space-y-3">
          {!result.validated && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-500">
              {result.validation_message ?? 'Low confidence — review carefully.'}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{result.actions?.length ?? 0} proposed actions</p>
            {result.actions && result.actions.length > 0 && (
              <Button size="sm" onClick={requestBuild}><Send className="h-3.5 w-3.5" /> Request this connector</Button>
            )}
          </div>
          <div className="space-y-1.5">
            {(result.actions ?? []).map(a => (
              <div key={a.slug} className="border rounded-lg p-3 bg-card">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{a.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${RISK_COLOR[a.risk] ?? 'bg-muted'}`}>{a.risk}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{a.method} {a.path}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

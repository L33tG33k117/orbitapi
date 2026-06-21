'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Webhook, Plus, Copy, Play, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'

interface Item { id: string; name: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Endpoint = any

export function WebhooksClient({ initialEndpoints, skills, playbooks }: { initialEndpoints: Endpoint[]; skills: Item[]; playbooks: Item[] }) {
  const router = useRouter()
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initialEndpoints)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState<'event' | 'skill' | 'playbook'>('event')
  const [targetId, setTargetId] = useState('')
  const [eventName, setEventName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Resolve after mount so server + first client render match (no hydration mismatch).
  const [baseUrl, setBaseUrl] = useState('')
  useEffect(() => setBaseUrl(window.location.origin), [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const res = await fetch('/api/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), target_type: targetType,
        target_id: targetType === 'event' ? null : targetId || null,
        event_name: targetType === 'event' ? eventName : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Create failed'); return }
    setEndpoints(eps => [data, ...eps])
    setCreating(false); setName(''); setTargetId(''); setEventName('')
    toast.success('Endpoint created')
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copied') }

  async function remove(id: string) {
    if (!confirm('Delete this endpoint? Delivery history is removed too.')) return
    const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    if (res.ok) { setEndpoints(eps => eps.filter(e => e.id !== id)); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      {creating ? (
        <form onSubmit={create} className="border rounded-xl p-4 bg-card space-y-3">
          <div className="space-y-1.5"><Label htmlFor="wname">Name</Label>
            <Input id="wname" value={name} onChange={e => setName(e.target.value)} placeholder="Lodgify booking webhook" required autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="wtype">On delivery</Label>
            <select id="wtype" value={targetType} onChange={e => setTargetType(e.target.value as typeof targetType)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="event">Emit an event (resume waiting playbooks)</option>
              <option value="playbook">Run a playbook</option>
              <option value="skill">Run a skill</option>
            </select></div>
          {targetType === 'event' ? (
            <div className="space-y-1.5"><Label htmlFor="wev">Event name</Label>
              <Input id="wev" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="guest_replied" /></div>
          ) : (
            <div className="space-y-1.5"><Label htmlFor="wtgt">{targetType}</Label>
              <select id="wtgt" value={targetId} onChange={e => setTargetId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select…</option>
                {(targetType === 'skill' ? skills : playbooks).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select></div>
          )}
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New endpoint</Button>
      )}

      {endpoints.length === 0 && !creating && (
        <div className="py-10 text-center border border-dashed rounded-xl text-muted-foreground">
          <Webhook className="h-8 w-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm">No webhook endpoints yet.</p>
        </div>
      )}

      {endpoints.map(ep => (
        <EndpointRow key={ep.id} ep={ep} baseUrl={baseUrl} expanded={expanded === ep.id}
          onToggle={() => setExpanded(expanded === ep.id ? null : ep.id)}
          onCopy={copy} onDelete={() => remove(ep.id)} onRefresh={() => router.refresh()} />
      ))}
    </div>
  )
}

function EndpointRow({ ep, baseUrl, expanded, onToggle, onCopy, onDelete, onRefresh }: {
  ep: Endpoint; baseUrl: string; expanded: boolean
  onToggle: () => void; onCopy: (t: string) => void; onDelete: () => void; onRefresh: () => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [secret, setSecret] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [lang, setLang] = useState<'curl' | 'powershell' | 'python'>('curl')
  const url = `${baseUrl}/api/hooks/${ep.token}`

  async function loadDetail() {
    const res = await fetch(`/api/webhooks/${ep.id}`)
    const data = await res.json()
    if (res.ok) { setDeliveries(data.deliveries ?? []); setSecret(data.signing_secret) }
  }

  async function test() {
    setTesting(true)
    const res = await fetch(`/api/webhooks/${ep.id}/replay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { test: true, at: new Date().toISOString() } }),
    })
    const data = await res.json()
    setTesting(false)
    if (res.ok) { toast.success(data.summary ?? 'Test dispatched'); loadDetail() }
    else toast.error(data.error ?? 'Test failed')
  }

  function toggle() { if (!expanded) loadDetail(); onToggle() }

  return (
    <div className="border rounded-xl bg-card">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-4 text-left">
        <Webhook className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{ep.name}</p>
          <p className="text-xs text-muted-foreground">
            {ep.target_type === 'event' ? `event: ${ep.event_name}` : ep.target_type}
            {ep.require_signature ? ' · signed' : ' · unsigned'}
            {ep.last_delivery_at ? ` · last ${new Date(ep.last_delivery_at).toLocaleDateString()}` : ' · no deliveries'}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${ep.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{ep.enabled ? 'on' : 'off'}</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate font-mono">{url}</code>
              <Button size="sm" variant="outline" onClick={() => onCopy(url)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {secret && (
            <div className="space-y-1.5">
              <Label>Signing secret (X-Orbit-Signature header)</Label>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate font-mono">{secret}</code>
                <Button size="sm" variant="outline" onClick={() => onCopy(secret)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Sign the raw body: <code>sha256=HMAC_SHA256(secret, body)</code></p>
            </div>
          )}

          {(() => {
            const signed = ep.require_signature
            const ex = {
              curl: signed
                ? `SECRET='<paste signing secret>'\nBODY='{"event":"ping"}'\nSIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/.* //')"\ncurl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Orbit-Signature: $SIG" \\\n  -d "$BODY"`
                : `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"ping"}'`,
              powershell: signed
                ? `$secret = '<paste signing secret>'\n$body = '{"event":"ping"}'\n$h = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))\n$hash = (($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString('x2') }) -join '')\nInvoke-RestMethod -Method Post -Uri '${url}' -ContentType 'application/json' -Headers @{ 'X-Orbit-Signature' = "sha256=$hash" } -Body $body`
                : `Invoke-RestMethod -Method Post -Uri '${url}' -ContentType 'application/json' -Body '{"event":"ping"}'`,
              python: signed
                ? `import hmac, hashlib, requests\nsecret = "<paste signing secret>"\nbody = '{"event":"ping"}'\nsig = "sha256=" + hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()\nrequests.post("${url}", data=body,\n              headers={"Content-Type": "application/json", "X-Orbit-Signature": sig})`
                : `import requests\nrequests.post("${url}", json={"event": "ping"})`,
            }[lang]
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Usage examples</Label>
                  <div className="flex gap-1">
                    {(['curl', 'powershell', 'python'] as const).map(l => (
                      <button key={l} onClick={() => setLang(l)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${lang === l ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {l === 'curl' ? 'cURL' : l === 'powershell' ? 'PowerShell' : 'Python'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <pre className="text-[11px] bg-muted rounded p-3 pr-10 overflow-x-auto font-mono whitespace-pre">{ex}</pre>
                  <Button size="sm" variant="outline" className="absolute top-1.5 right-1.5 h-7 px-2" onClick={() => onCopy(ex)}><Copy className="h-3 w-3" /></Button>
                </div>
                {signed && <p className="text-[11px] text-muted-foreground">Use the signing secret shown above. The signature is <code>sha256=</code> + HMAC-SHA256 of the exact raw body.</p>}
              </div>
            )
          })()}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={test} disabled={testing}><Play className="h-3.5 w-3.5" /> {testing ? 'Testing…' : 'Send test payload'}</Button>
            <Button size="sm" variant="outline" onClick={() => { loadDetail(); onRefresh() }}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Recent deliveries</p>
            {deliveries.length === 0 && <p className="text-xs text-muted-foreground">No deliveries yet.</p>}
            <div className="space-y-1">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 bg-background">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    d.status === 'dispatched' ? 'bg-emerald-500/10 text-emerald-500' :
                    d.status === 'rejected' || d.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-muted'
                  }`}>{d.status}</span>
                  {d.is_replay && <span className="text-[10px] text-primary">test</span>}
                  <span className={`text-[10px] ${d.signature_valid ? 'text-emerald-500' : 'text-muted-foreground'}`}>{d.signature_valid ? 'sig ✓' : 'no sig'}</span>
                  <span className="flex-1 truncate text-muted-foreground">{d.dispatch_summary ?? d.error ?? ''}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(d.received_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

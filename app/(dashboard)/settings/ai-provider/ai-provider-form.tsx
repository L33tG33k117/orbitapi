'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface AiProviderSettings {
  baseUrl: string
  modelName: string
  maxOutputTokens: number | null
  enabled: boolean
  hasApiKey: boolean
}

interface Props {
  entitled: boolean
  initial: AiProviderSettings | null
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; ms: number; reply: string }
  | { status: 'error'; message: string }

export function AiProviderForm({ entitled, initial }: Props) {
  const router = useRouter()
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [modelName, setModelName] = useState(initial?.modelName ?? '')
  const [maxTokens, setMaxTokens] = useState(initial?.maxOutputTokens?.toString() ?? '')
  // Never populated from the server — the stored key is write-only. Left blank
  // means "keep whatever is saved"; see the PUT handler.
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  const configured = !!initial
  const usingLocal = configured && (initial?.enabled ?? false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/ai-provider', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl,
        modelName,
        enabled,
        maxOutputTokens: maxTokens ? Number(maxTokens) : null,
        // Only send the key field when the admin actually typed one.
        ...(apiKey ? { apiKey } : {}),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('Saved.')
      setApiKey('')
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg(d.error ?? d.message ?? 'Failed to save.')
    }
  }

  async function runTest() {
    setTest({ status: 'testing' })
    const res = await fetch('/api/ai-provider/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, modelName, ...(apiKey ? { apiKey } : {}) }),
    })
    const d = await res.json().catch(() => ({}))
    if (d.ok) setTest({ status: 'ok', ms: d.ms, reply: d.reply })
    else setTest({ status: 'error', message: d.error ?? 'Could not reach that address.' })
  }

  async function removeProvider() {
    if (!confirm('Switch back to Claude? Your endpoint details and API key will be deleted.')) return
    setSaving(true)
    await fetch('/api/ai-provider', { method: 'DELETE' })
    setSaving(false)
    setBaseUrl(''); setModelName(''); setMaxTokens(''); setApiKey('')
    setTest({ status: 'idle' })
    setMsg('Switched back to Claude.')
    router.refresh()
  }

  if (!entitled) {
    return (
      <div className="border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold">Your own AI model</h2>
        <p className="text-sm text-muted-foreground">
          Orbit currently runs on Claude, hosted by us — nothing for you to set up or maintain.
          Running Orbit against an AI model on your own hardware is available on self-hosted
          installations and by arrangement for enterprise customers.
        </p>
        <p className="text-sm text-muted-foreground">
          Talk to us if your organization needs data to stay inside your own network.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Which AI runs Orbit</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {usingLocal
              ? `Orbit is using your own model (${initial?.modelName}). Nothing is sent to Anthropic.`
              : 'Orbit is using Claude, hosted by us. Point it at your own model below to keep everything on your network.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">Model server address</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="http://192.168.1.50:11434/v1"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            The OpenAI-compatible address of your model server. Ollama, LM Studio and vLLM all
            provide one — it usually ends in <code>/v1</code>.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="modelName">Model name</Label>
          <Input
            id="modelName"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            placeholder="llama3.1:70b"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Exactly as your server names it. We recommend a recent 30B+ instruct model with tool
            calling — smaller models often can&apos;t drive multi-step skills reliably, and complex
            skills may need to be split into simpler steps.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API key <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={initial?.hasApiKey ? '•••••••• (saved — leave blank to keep)' : 'Usually not needed'}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Most local model servers don&apos;t need one. Fill this in only if yours sits behind a
            proxy that requires a key.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxTokens">Longest reply <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="maxTokens"
            type="number"
            min={256}
            value={maxTokens}
            onChange={e => setMaxTokens(e.target.value)}
            placeholder="8192"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Caps how much your model may write in one go. Leave blank unless runs are getting cut
            off or your model rejects long replies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" variant="outline" onClick={runTest} disabled={!baseUrl || !modelName || test.status === 'testing'}>
            {test.status === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          <Button type="submit" disabled={saving || !baseUrl || !modelName}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {configured && (
            <Button type="button" variant="ghost" onClick={removeProvider} disabled={saving}>
              Switch back to Claude
            </Button>
          )}
        </div>

        {test.status === 'ok' && (
          <p className="text-sm text-emerald-500">
            Connected — your model replied in {(test.ms / 1000).toFixed(1)}s. Don&apos;t forget to save.
          </p>
        )}
        {test.status === 'error' && (
          <p className="text-sm text-destructive">{test.message}</p>
        )}
        {msg && (
          <p className={`text-sm ${msg.startsWith('Saved') || msg.startsWith('Switched') ? 'text-emerald-500' : 'text-destructive'}`}>{msg}</p>
        )}
      </div>

      {configured && (
        <div className="border rounded-lg p-5 space-y-3">
          <div>
            <h2 className="text-base font-semibold">Use my model</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Turn this off to go back to Claude without deleting your settings.
            </p>
          </div>
          <div className="flex gap-3">
            {[{ v: true, label: 'My own model' }, { v: false, label: 'Claude (hosted)' }].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setEnabled(opt.v)}
                className={`flex-1 text-left p-4 rounded-xl border text-sm transition-all ${
                  enabled === opt.v
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Press Save above to apply.</p>
        </div>
      )}
    </form>
  )
}

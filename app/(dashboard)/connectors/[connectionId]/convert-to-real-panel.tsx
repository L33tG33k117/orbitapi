'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiKeyAuth, OAuth2Auth, CredentialField } from '@/connectors/types'

interface Props {
  connectionId: string
  connectorSlug: string
  connectorName: string
  currentLabel: string
  auth: ApiKeyAuth | OAuth2Auth
}

export function ConvertToRealPanel({ connectionId, connectorName, currentLabel, auth }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(currentLabel.replace(' (Simulated)', '').replace(' — Simulated', ''))
  const [apiKey, setApiKey] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; label?: string; error?: string } | null>(null)

  const apiAuth = auth.type === 'api_key' ? auth : null
  const multiFields: CredentialField[] | undefined = apiAuth?.fields

  function buildCredentials(): Record<string, string> {
    if (multiFields?.length) {
      return Object.fromEntries(multiFields.map(f => [f.key, fieldValues[f.key] ?? '']))
    }
    return { api_key: apiKey }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setTestResult(null)

    const res = await fetch(`/api/connections/${connectionId}/convert-to-real`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: buildCredentials(), label: label.trim() || currentLabel }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Conversion failed')
      setLoading(false)
      return
    }

    setTestResult(data.test)
    setLoading(false)

    if (data.test?.ok) {
      setTimeout(() => router.refresh(), 1500)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
        <FlaskConical className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-violet-300">Running in simulation mode</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This connection returns realistic fake data. To use real {connectorName} data, convert it to a
            live connection — your skills, groups, and configurations will be preserved.
          </p>
        </div>
        {!open && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            className="shrink-0 gap-1.5 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Convert to real
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Convert to real connection</p>
            <button
              onClick={() => { setOpen(false); setError(null); setTestResult(null) }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your {connectorName} credentials. All skills and groups linked to this connection
            will continue to work — nothing is lost.
          </p>

          <form onSubmit={handleConvert} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="real-label">Connection name</Label>
              <Input
                id="real-label"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={connectorName}
              />
            </div>

            {auth.type === 'api_key' && (
              multiFields?.length ? (
                multiFields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`real-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`real-${field.key}`}
                      type={field.inputType ?? 'password'}
                      placeholder={field.placeholder}
                      value={fieldValues[field.key] ?? ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                    {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="real-key">{apiAuth?.keyLabel ?? 'API Key'}</Label>
                  <Input
                    id="real-key"
                    type="password"
                    placeholder={apiAuth?.keyPlaceholder ?? 'sk-...'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    required
                    autoComplete="off"
                  />
                  {apiAuth?.keyHint && <p className="text-xs text-muted-foreground">{apiAuth.keyHint}</p>}
                </div>
              )
            )}

            {auth.type === 'oauth2' && (
              <p className="text-xs text-amber-400">
                OAuth2 connectors cannot be converted in-place. Please disconnect and reconnect via the catalog.
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {testResult && (
              <div className={`rounded-md p-3 flex items-center gap-2 text-sm ${
                testResult.ok
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {testResult.ok
                  ? `Connected — ${testResult.label ?? 'connection verified'}. Refreshing…`
                  : `Test failed: ${testResult.error}`}
              </div>
            )}

            {auth.type === 'api_key' && (
              <Button type="submit" disabled={loading} className="w-full gap-2">
                <ArrowRight className="h-4 w-4" />
                {loading ? 'Converting…' : 'Convert & test'}
              </Button>
            )}
          </form>
        </div>
      )}
    </section>
  )
}

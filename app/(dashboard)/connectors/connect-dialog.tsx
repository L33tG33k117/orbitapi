'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'
import type { ConnectorSummary, CredentialField } from '@/connectors/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

function inlineMarkdown(text: string) {
  return { __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }
}

interface Props {
  connector: ConnectorSummary
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ConnectDialog({ connector, open, onOpenChange }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')        // used for single-field auth
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; label?: string; error?: string } | null>(null)

  const guide = connector.auth.type === 'api_key' ? connector.auth.setupGuide : []
  const auth = connector.auth.type === 'api_key' ? connector.auth : null
  const multiFields: CredentialField[] | undefined = auth?.fields
  const isGuideStep = step === 0 && guide.length > 0
  const notices = guide.filter(s => s.kind === 'notice')
  const legacySteps = guide.filter(s => s.kind === 'legacy')
  const mainSteps = guide.filter(s => s.kind !== 'notice' && s.kind !== 'legacy')

  function reset() {
    setStep(0); setLabel(''); setApiKey(''); setFieldValues({}); setError(null); setTestResult(null)
  }

  function buildCredentials(): Record<string, string> {
    if (multiFields?.length) {
      return Object.fromEntries(multiFields.map(f => [f.key, fieldValues[f.key] ?? '']))
    }
    return { api_key: apiKey }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setTestResult(null)

    const credentials = buildCredentials()

    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectorSlug: connector.slug,
        label: label || connector.name,
        credentials,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    const testRes = await fetch(`/api/connections/${data.connection.id}/test`, { method: 'POST' })
    const testData = await testRes.json()
    setTestResult(testData)
    setLoading(false)

    if (testData.ok) {
      setTimeout(() => {
        onOpenChange(false)
        reset()
        router.refresh()
      }, 1500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className={isGuideStep ? 'max-w-xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {connector.logoUrl && (
              <img src={connector.logoUrl} alt="" className="h-6 w-6 rounded" />
            )}
            Connect {connector.name}
            {connector.isSimulated && <Badge variant="secondary" className="text-xs">Simulated</Badge>}
          </DialogTitle>
          <DialogDescription>{connector.description}</DialogDescription>
        </DialogHeader>

        {connector.auth.type === 'oauth2' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oauth-label">Connection name</Label>
              <Input
                id="oauth-label"
                placeholder={connector.name}
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              You&apos;ll be redirected to {connector.name} to authorize access, then sent back here. No keys to copy.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = `/api/oauth/${connector.slug}/start?label=${encodeURIComponent(label || connector.name)}`
              }}
            >
              Connect with {connector.name} →
            </Button>
          </div>
        ) : isGuideStep ? (
          <div className="space-y-4">
            {notices.map((s, i) => (
              <div
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                <p className="font-medium">{s.title}</p>
                <p className="mt-0.5" dangerouslySetInnerHTML={inlineMarkdown(s.description)} />
              </div>
            ))}
            <div className="space-y-4">
              {mainSteps.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5"
                       dangerouslySetInnerHTML={inlineMarkdown(s.description)}
                    />
                  </div>
                </div>
              ))}
            </div>
            {legacySteps.length > 0 && (
              <details className="group rounded-md border p-3">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" />
                  {legacySteps.length === 1 ? legacySteps[0].title : 'Legacy options'}
                </summary>
                <div className="mt-3 space-y-3 pl-4.5">
                  {legacySteps.map((s, i) => (
                    <p key={i} className="text-sm text-muted-foreground" dangerouslySetInnerHTML={inlineMarkdown(s.description)} />
                  ))}
                </div>
              </details>
            )}
            <Button className="w-full" onClick={() => setStep(1)}>
              I have my {auth?.keyLabel ?? 'credentials'} →
            </Button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conn-label">Connection name</Label>
              <Input
                id="conn-label"
                placeholder={connector.name}
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">A friendly name for this connection (e.g. "Production NetSuite")</p>
            </div>

            {multiFields?.length ? (
              multiFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
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
                <Label htmlFor="conn-key">{auth?.keyLabel ?? 'API Key'}</Label>
                <Input
                  id="conn-key"
                  type={connector.isSimulated ? 'text' : 'password'}
                  placeholder={auth?.keyPlaceholder}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  required
                  autoComplete="off"
                />
                {auth?.keyHint && <p className="text-xs text-muted-foreground">{auth.keyHint}</p>}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {testResult && (
              <div className={`rounded-md p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-destructive/10 text-destructive'}`}>
                {testResult.ok
                  ? `✓ Connected — ${testResult.label ?? 'success'}`
                  : `Connection test failed: ${testResult.error}`}
              </div>
            )}

            <div className="flex gap-2">
              {guide.length > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button>
              )}
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Connecting…' : 'Connect & test'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

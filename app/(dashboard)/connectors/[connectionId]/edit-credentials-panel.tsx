'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiKeyAuth, OAuth2Auth, CredentialField } from '@/connectors/types'

interface Props {
  connectionId: string
  currentLabel: string
  auth: ApiKeyAuth | OAuth2Auth
}

export function EditCredentialsPanel({ connectionId, currentLabel, auth }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(currentLabel)
  const [apiKey, setApiKey] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [testFirst, setTestFirst] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const multiFields: CredentialField[] | undefined = auth.type === 'api_key' ? auth.fields : undefined
  const hasCredentialChange = multiFields?.length
    ? Object.values(fieldValues).some(v => v.trim() !== '')
    : apiKey.trim() !== ''

  async function save() {
    if (label === currentLabel && !hasCredentialChange) {
      setStatus({ type: 'error', message: 'No changes to save.' })
      return
    }

    setSaving(true)
    setStatus(null)

    const body: Record<string, unknown> = {}
    if (label !== currentLabel) body.label = label

    if (hasCredentialChange) {
      body.credentials = multiFields?.length
        ? Object.fromEntries(multiFields.filter(f => fieldValues[f.key]?.trim()).map(f => [f.key, fieldValues[f.key]]))
        : { api_key: apiKey }
      body.testFirst = testFirst
    }

    const res = await fetch(`/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)

    if (res.ok) {
      setStatus({ type: 'success', message: 'Saved successfully.' })
      setApiKey('')
      setFieldValues({})
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({ error: 'Unknown error' }))
      setStatus({ type: 'error', message: d.error ?? 'Save failed.' })
    }
  }

  if (auth.type === 'oauth2') {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        OAuth2 credentials are managed automatically via the connection flow. To re-authenticate, delete and re-add this connection.
      </div>
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit credentials
      </Button>
    )
  }

  return (
    <div className="rounded-lg border p-5 space-y-4 bg-muted/20">
      <div className="space-y-1.5">
        <Label htmlFor="conn-label">Connection name</Label>
        <Input
          id="conn-label"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </div>

      {multiFields?.length ? (
        multiFields.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
            <Input
              id={`edit-${field.key}`}
              type={field.inputType ?? 'password'}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={`Leave blank to keep existing • ${field.placeholder}`}
              autoComplete="off"
            />
            {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="conn-apikey">{auth.keyLabel}</Label>
          <Input
            id="conn-apikey"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={`Leave blank to keep existing • ${auth.keyPlaceholder}`}
            autoComplete="off"
          />
          {auth.keyHint && (
            <p className="text-xs text-muted-foreground">{auth.keyHint}</p>
          )}
        </div>
      )}

      {hasCredentialChange && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={testFirst}
            onChange={e => setTestFirst(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Test connection before saving
        </label>
      )}

      {status && (
        <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
          {status.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setStatus(null); setApiKey(''); setFieldValues({}) }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

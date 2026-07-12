'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FlaskConical, Trash2, X, Clock, Zap, Settings2, Play, PlugZap, Square, CheckSquare } from 'lucide-react'

interface Connection {
  id: string
  label: string
  status: string
  is_simulated: boolean
  created_at: string
  vault_secret_id?: string | null
  connector: { slug: string; name: string; category: string; is_simulated: boolean } | null
}

// Derive a human health state. "Needs setup" catches real connections created
// without credentials yet (e.g. installed by a bundle) — previously invisible
// until a skill failed.
function health(c: Connection): { label: string; dot: string; text: string } {
  if (c.status === 'error') return { label: 'Error', dot: 'bg-red-500', text: 'text-red-500' }
  if (!c.is_simulated && !c.vault_secret_id) return { label: 'Needs setup', dot: 'bg-amber-500', text: 'text-amber-500' }
  if (c.status === 'disconnected') return { label: 'Disconnected', dot: 'bg-gray-400', text: 'text-muted-foreground' }
  return { label: c.is_simulated ? 'Simulated' : 'Active', dot: 'bg-green-500', text: 'text-green-500' }
}

interface DeleteModalProps {
  connections: Connection[]
  defaultMode: 'trash' | 'permanent'
  locked?: boolean
  onCancel: () => void
  onConfirm: (mode: 'trash' | 'permanent') => void
  loading: boolean
}

function DeleteModal({ connections, defaultMode, locked, onCancel, onConfirm, loading }: DeleteModalProps) {
  const [mode, setMode] = useState<'trash' | 'permanent'>(defaultMode)
  const many = connections.length > 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl space-y-5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{many ? `Remove ${connections.length} connections` : 'Remove connection'}</p>
            <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-xs">
              {many ? connections.map(c => c.label).join(', ') : connections[0]?.label}
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {locked ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
            <div className="flex items-center gap-2">
              {defaultMode === 'trash' ? <Clock className="h-4 w-4 text-primary shrink-0" /> : <Zap className="h-4 w-4 text-destructive shrink-0" />}
              <p className="text-sm font-medium">{defaultMode === 'trash' ? 'Move to Trash' : 'Delete Forever'}</p>
            </div>
            <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
              {defaultMode === 'trash'
                ? 'Connection is disabled and held for 7 days, then auto-purged. Restore from the Trash bin.'
                : 'Immediately and permanently removes the connection and all its data. Cannot be undone.'}
            </p>
            <p className="text-[11px] text-muted-foreground pl-6 pt-1">Set by your workspace admin.</p>
          </div>
        ) : (
        <div className="space-y-2">
          <button
            onClick={() => setMode('trash')}
            className={`w-full text-left p-4 rounded-xl border transition-all space-y-1 ${
              mode === 'trash'
                ? 'border-primary bg-primary/8'
                : 'border-border hover:border-muted-foreground/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 shrink-0 ${mode === 'trash' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-medium ${mode === 'trash' ? 'text-primary' : ''}`}>Move to Trash</p>
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-muted text-muted-foreground ml-auto">Recommended</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
              {many ? 'Connections are' : 'Connection is'} disabled and held for 7 days. Skills and groups are preserved. Restore at any time from the Trash bin.
            </p>
          </button>

          <button
            onClick={() => setMode('permanent')}
            className={`w-full text-left p-4 rounded-xl border transition-all space-y-1 ${
              mode === 'permanent'
                ? 'border-destructive/60 bg-destructive/5'
                : 'border-border hover:border-muted-foreground/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 shrink-0 ${mode === 'permanent' ? 'text-destructive' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-medium ${mode === 'permanent' ? 'text-destructive' : ''}`}>Delete Forever</p>
            </div>
            <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
              Immediately and permanently removes {many ? 'these connections' : 'the connection'} and all {many ? 'their' : 'its'} data. Cannot be undone.
            </p>
          </button>
        </div>
        )}

        <div className="flex gap-2">
          <Button
            variant={mode === 'permanent' ? 'destructive' : 'default'}
            className="flex-1"
            disabled={loading}
            onClick={() => onConfirm(mode)}
          >
            {loading ? 'Removing…' : mode === 'trash' ? 'Move to Trash' : 'Delete Forever'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ConnectionList({
  connections,
  canManage,
  deletePreference = 'trash',
  deleteLocked = false,
}: {
  connections: Connection[]
  canManage: boolean
  deletePreference?: 'trash' | 'permanent'
  deleteLocked?: boolean
}) {
  const router = useRouter()
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [deleteTargets, setDeleteTargets] = useState<Connection[]>([])
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleTest(id: string) {
    setTesting(id)
    const res = await fetch(`/api/connections/${id}/test`, { method: 'POST' })
    const data = await res.json()
    setTestResults(r => ({ ...r, [id]: data }))
    setTesting(null)
    router.refresh()
  }

  async function handleDelete(mode: 'trash' | 'permanent') {
    if (deleteTargets.length === 0) return
    setDeleting(true)
    const results = await Promise.all(deleteTargets.map(async c => {
      const res = await fetch(`/api/connections/${c.id}?mode=${mode}`, { method: 'DELETE' })
      return { label: c.label, ok: res.ok }
    }))
    setDeleting(false)
    setDeleteTargets([])
    setSelected(new Set())
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      toast.error(`Couldn't remove ${failed.map(f => f.label).join(', ')}`)
    } else if (results.length > 1) {
      toast.success(mode === 'trash'
        ? `Moved ${results.length} connections to Trash`
        : `Deleted ${results.length} connections`)
    }
    router.refresh()
  }

  return (
    <>
      {canManage && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set(connections.map(c => c.id)))}
          >
            Select all
          </button>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => setDeleteTargets(connections.filter(c => selected.has(c.id)))}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove selected
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {connections.map(c => {
          const h = health(c)
          return (
          <div key={c.id} className={`border rounded-lg p-4 flex items-center gap-4 ${selected.has(c.id) ? 'border-primary/50 bg-primary/5' : ''}`}>
            {canManage && (
              <button
                onClick={() => toggleSelected(c.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={selected.has(c.id) ? `Deselect ${c.label}` : `Select ${c.label}`}
              >
                {selected.has(c.id)
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4" />}
              </button>
            )}
            <div className="relative shrink-0">
              <Image
                src={`/logos/${c.connector?.slug ?? 'default'}.svg`}
                alt={c.connector?.name ?? ''}
                width={36}
                height={36}
                className="rounded-lg"
                unoptimized
              />
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${h.dot}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{c.label}</p>
                {c.is_simulated && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-violet-500/15 text-violet-300 border border-violet-500/25 gap-1">
                    <FlaskConical className="h-2.5 w-2.5" />
                    Simulated
                  </Badge>
                )}
                <span className={`text-[10px] font-medium ${h.text}`}>· {h.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{c.connector?.name} · {c.connector?.category}</p>
              {testResults[c.id] && (
                <p className={`text-xs mt-1 ${testResults[c.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                  {testResults[c.id].ok ? '✓ Connected' : `✗ ${testResults[c.id].error}`}
                </p>
              )}
            </div>
            <div data-tour="connection-actions" className="flex items-center gap-2 shrink-0">
              <Link href={`/connectors/${c.id}/manual`}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Use now
                </Button>
              </Link>
              <Link href={`/connectors/${c.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  {c.is_simulated ? 'Manage / Convert' : 'Manage'}
                </Button>
              </Link>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={testing === c.id} onClick={() => handleTest(c.id)}>
                    <PlugZap className="h-3.5 w-3.5" />
                    {testing === c.id ? 'Testing…' : 'Test'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive gap-1.5"
                    onClick={() => setDeleteTargets([c])}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {deleteTargets.length > 0 && (
        <DeleteModal
          locked={deleteLocked}
          connections={deleteTargets}
          defaultMode={deletePreference}
          onCancel={() => setDeleteTargets([])}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </>
  )
}

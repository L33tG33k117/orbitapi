'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FlaskConical, AlertTriangle, Trash2, Camera, ExternalLink,
  Clock, CheckCircle2, Plus, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SandboxWorkspace {
  id: string
  name: string
  is_sandbox: boolean
  created_at: string
}

interface Snapshot {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface SnapshotDetail extends Snapshot {
  snapshot_data: {
    captured_at: string
    connection_count: number
    connections: { label: string; connector_slug: string; connector_name: string }[]
    skills: { name: string; enabled: boolean }[]
    groups: { name: string }[]
  }
}

export default function AdminSandboxPage() {
  const [workspace, setWorkspace] = useState<SandboxWorkspace | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotDesc, setSnapshotDesc] = useState('')
  const [takingSnapshot, setTakingSnapshot] = useState(false)
  const [showSnapshotForm, setShowSnapshotForm] = useState(false)
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null)
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetail | null>(null)
  const [deletingSnapshot, setDeletingSnapshot] = useState<string | null>(null)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/sandbox')
    const data = await res.json()
    setWorkspace(data.workspace ?? null)
    setSnapshots(data.snapshots ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createSandbox() {
    setCreating(true)
    const res = await fetch('/api/admin/sandbox', { method: 'POST' })
    const data = await res.json()
    if (data.workspace) setWorkspace(data.workspace)
    setCreating(false)
  }

  async function resetSandbox() {
    if (!workspace) return
    if (!confirm('Reset sandbox? This will delete all connections, skills, and groups in your sandbox workspace. This cannot be undone.')) return
    setResetting(true)
    await fetch(`/api/admin/sandbox?workspaceId=${workspace.id}`, { method: 'DELETE' })
    setResetting(false)
    alert('Sandbox has been reset.')
  }

  async function takeSnapshot() {
    if (!workspace || !snapshotName.trim()) return
    setTakingSnapshot(true)
    const res = await fetch('/api/admin/sandbox/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: snapshotName, description: snapshotDesc, workspaceId: workspace.id }),
    })
    const data = await res.json()
    if (data.snapshot) {
      setSnapshots(prev => [data.snapshot, ...prev])
      setSnapshotName('')
      setSnapshotDesc('')
      setShowSnapshotForm(false)
    }
    setTakingSnapshot(false)
  }

  async function loadSnapshotDetail(id: string) {
    if (expandedSnapshot === id) {
      setExpandedSnapshot(null)
      setSnapshotDetail(null)
      return
    }
    setExpandedSnapshot(id)
    const res = await fetch(`/api/admin/sandbox/snapshots/${id}`)
    const data = await res.json()
    if (data.snapshot) setSnapshotDetail(data.snapshot)
  }

  async function deleteSnapshot(id: string) {
    setDeletingSnapshot(id)
    await fetch(`/api/admin/sandbox/snapshots/${id}`, { method: 'DELETE' })
    setSnapshots(prev => prev.filter(s => s.id !== id))
    if (expandedSnapshot === id) { setExpandedSnapshot(null); setSnapshotDetail(null) }
    setDeletingSnapshot(null)
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <FlaskConical className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sandbox</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            An isolated workspace for testing connectors, skills, and the AI assistant.
          </p>
        </div>
      </div>

      {/* Non-persistence banner */}
      {!dismissedBanner && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-amber-300">Sandbox — not for production</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your sandbox workspace is for testing only. You can <strong className="text-foreground">reset it</strong> at
              any time to wipe all connections, skills, and groups. Use <strong className="text-foreground">snapshots</strong> to
              save a point-in-time view of your test setup before resetting. Credentials stored in the
              sandbox are real — do not use production API keys here.
            </p>
          </div>
          <button
            onClick={() => setDismissedBanner(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Loading sandbox…
        </div>
      ) : !workspace ? (
        /* No sandbox yet — prompt to create */
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-violet-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">No sandbox yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create your personal sandbox workspace to start testing connectors and the AI assistant
              without affecting any production workspace.
            </p>
          </div>
          <Button onClick={createSandbox} disabled={creating} className="gap-2">
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : 'Create Sandbox'}
          </Button>
        </div>
      ) : (
        <>
          {/* Workspace card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <FlaskConical className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(workspace.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 font-medium">
                Sandbox
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <a
                href="/dashboard"
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Sandbox App
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={resetSandbox}
                disabled={resetting}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {resetting ? 'Resetting…' : 'Reset Sandbox'}
              </Button>
            </div>
          </div>

          {/* Snapshot section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Snapshots</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save a point-in-time view of your sandbox state before resetting.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSnapshotForm(v => !v)}
                className="gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                Take Snapshot
              </Button>
            </div>

            {showSnapshotForm && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-medium">New snapshot</p>
                <Input
                  placeholder='Snapshot name (e.g. "Before adding Slack")'
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                />
                <Input
                  placeholder="Description (optional)"
                  value={snapshotDesc}
                  onChange={e => setSnapshotDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={takeSnapshot}
                    disabled={takingSnapshot || !snapshotName.trim()}
                    className="gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {takingSnapshot ? 'Saving…' : 'Save Snapshot'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSnapshotForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {snapshots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No snapshots yet. Take a snapshot before resetting to save your test setup.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {snapshots.map(snap => (
                  <div key={snap.id}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <Camera className="h-4 w-4 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{snap.name}</p>
                        {snap.description && (
                          <p className="text-xs text-muted-foreground truncate">{snap.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(snap.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => loadSnapshotDetail(snap.id)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="View details"
                        >
                          {expandedSnapshot === snap.id
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteSnapshot(snap.id)}
                          disabled={deletingSnapshot === snap.id}
                          className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400 disabled:opacity-50"
                          title="Delete snapshot"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {expandedSnapshot === snap.id && snapshotDetail && snapshotDetail.id === snap.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground pt-3">
                          Captured {new Date(snapshotDetail.snapshot_data.captured_at).toLocaleString()}
                          {' · '}
                          {snapshotDetail.snapshot_data.connection_count} connection{snapshotDetail.snapshot_data.connection_count !== 1 ? 's' : ''}
                        </p>
                        {snapshotDetail.snapshot_data.connections.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Connections</p>
                            {snapshotDetail.snapshot_data.connections.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                <span className="font-medium">{c.label}</span>
                                <span className="text-muted-foreground">({c.connector_name})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {snapshotDetail.snapshot_data.skills.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills</p>
                            {snapshotDetail.snapshot_data.skills.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <CheckCircle2 className={`h-3 w-3 shrink-0 ${s.enabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                                <span>{s.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {expandedSnapshot === snap.id && !snapshotDetail && (
                      <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                        Loading…
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

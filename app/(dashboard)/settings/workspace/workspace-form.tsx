'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  workspaceId: string
  currentName: string
  isOwner: boolean
  connectionDeleteDefault: 'trash' | 'permanent'
  connectionDeleteLocked: boolean
}

export function WorkspaceForm({ workspaceId, currentName, isOwner, connectionDeleteDefault, connectionDeleteLocked }: Props) {
  const router = useRouter()
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  // Connection deletion policy
  const [delDefault, setDelDefault] = useState<'trash' | 'permanent'>(connectionDeleteDefault)
  const [delLocked, setDelLocked] = useState(connectionDeleteLocked)
  const [policyMsg, setPolicyMsg] = useState<string | null>(null)

  async function savePolicy(patch: { connectionDeleteDefault?: 'trash' | 'permanent'; connectionDeleteLocked?: boolean }) {
    setPolicyMsg(null)
    if (patch.connectionDeleteDefault) setDelDefault(patch.connectionDeleteDefault)
    if (patch.connectionDeleteLocked !== undefined) setDelLocked(patch.connectionDeleteLocked)
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) { setPolicyMsg('Saved.'); router.refresh() }
    else { const d = await res.json().catch(() => ({})); setPolicyMsg(d.error ?? 'Failed to save.') }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || name.trim() === currentName) return
    setSaving(true)
    setNameError(null)
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2000)
    } else {
      const d = await res.json().catch(() => ({}))
      setNameError(d.error ?? 'Failed to save')
    }
  }

  async function deleteWorkspace() {
    if (confirmDelete !== currentName) return
    setDeleting(true)
    const res = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/login')
    } else {
      setDeleting(false)
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Delete failed')
    }
  }

  return (
    <div className="space-y-8">
      {/* Rename */}
      <div className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Workspace name</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isOwner ? 'Rename your workspace.' : 'Only the owner can rename the workspace.'}
          </p>
        </div>
        <form onSubmit={saveName} className="flex gap-3 items-end max-w-sm">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={e => { setName(e.target.value); setSaved(false) }}
              disabled={!isOwner}
            />
          </div>
          {isOwner && (
            <Button type="submit" size="sm" disabled={saving || !name.trim() || name.trim() === currentName}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </form>
        {saved && <p className="text-sm text-green-600">Saved.</p>}
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>

      {/* Connection deletion policy */}
      <div className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Connection deletion policy</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sets what happens when someone removes a connection, for the whole workspace.
          </p>
        </div>
        <div className="flex gap-3">
          {([
            { value: 'trash', label: 'Move to Trash', desc: 'Kept 7 days, restorable, then auto-purged.' },
            { value: 'permanent', label: 'Delete Forever', desc: 'Immediate, permanent removal.' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => savePolicy({ connectionDeleteDefault: opt.value })}
              className={`flex-1 text-left p-4 rounded-xl border text-sm transition-all ${
                delDefault === opt.value ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
              }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs mt-1 leading-relaxed opacity-80">{opt.desc}</p>
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={delLocked} onChange={e => savePolicy({ connectionDeleteLocked: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="font-medium">Enforce for everyone</span>
            <span className="block text-xs text-muted-foreground">When on, members can&apos;t choose a different option — this default always applies. When off, it&apos;s just the default and users may override per delete.</span>
          </span>
        </label>
        {policyMsg && <p className={`text-sm ${policyMsg === 'Saved.' ? 'text-emerald-500' : 'text-destructive'}`}>{policyMsg}</p>}
      </div>

      {/* Workspace ID (useful for API calls) */}
      <div className="border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold">Workspace ID</h2>
        <code className="text-xs bg-muted px-2 py-1 rounded block w-fit select-all">{workspaceId}</code>
        <p className="text-xs text-muted-foreground">Use this ID when calling OrbitAPI programmatically.</p>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="border border-destructive/40 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deleting the workspace is permanent and cannot be undone. All connections, skills, groups, and data will be destroyed.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Type <strong>{currentName}</strong> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder={currentName}
              className="max-w-sm"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={confirmDelete !== currentName || deleting}
            onClick={deleteWorkspace}
          >
            {deleting ? 'Deleting…' : 'Delete workspace'}
          </Button>
        </div>
      )}
    </div>
  )
}

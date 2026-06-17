'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface Permissions {
  can_use_chat?: boolean
  can_view_audit?: boolean
  can_approve_actions?: boolean
  can_manage_skills?: boolean
  can_manage_connectors?: boolean
  can_view_usage?: boolean
  can_manage_members?: boolean
}

interface CustomRole {
  id: string
  name: string
  description: string | null
  permissions: Permissions
}

const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  can_use_chat: 'Use AI chat',
  can_view_audit: 'View audit log',
  can_approve_actions: 'Approve pending actions',
  can_manage_skills: 'Manage skills',
  can_manage_connectors: 'Manage connectors',
  can_view_usage: 'View usage',
  can_manage_members: 'Manage members',
}

const DEFAULT_PERMISSIONS: Permissions = {
  can_use_chat: true,
  can_view_audit: false,
  can_approve_actions: false,
  can_manage_skills: false,
  can_manage_connectors: false,
  can_view_usage: false,
  can_manage_members: false,
}

export function CustomRolesManager({ workspaceId, roles }: { workspaceId: string; roles: CustomRole[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/workspaces/custom-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, name: name.trim(), description: description.trim() || undefined, permissions }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create role')
    } else {
      setCreating(false)
      setName('')
      setDescription('')
      setPermissions(DEFAULT_PERMISSIONS)
      startTransition(() => router.refresh())
    }
    setSaving(false)
  }

  async function handleDelete(id: string, roleName: string) {
    if (!confirm(`Delete the "${roleName}" role? Members with this role will revert to User.`)) return
    await fetch(`/api/workspaces/custom-roles/${id}?workspaceId=${workspaceId}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  function togglePerm(key: keyof Permissions) {
    setPermissions(p => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Custom roles</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Define roles with specific permissions for your workspace.</p>
        </div>
        <button
          onClick={() => { setCreating(true); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New role
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Role name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Security Analyst"
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What can this role do?"
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PERMISSION_LABELS) as Array<keyof Permissions>).map(key => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!permissions[key]}
                      onChange={() => togglePerm(key)}
                      className="h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    <span className="text-xs group-hover:text-foreground transition-colors">{PERMISSION_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating…' : 'Create role'}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing roles */}
      {roles.length === 0 && !creating && (
        <div className="py-8 text-center border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">No custom roles yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a role to assign granular permissions to members.</p>
        </div>
      )}

      {roles.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
          {roles.map(role => {
            const enabledCount = Object.values(role.permissions).filter(Boolean).length
            const isExp = expanded === role.id
            return (
              <div key={role.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExp ? null : role.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{role.name}</p>
                      {role.description && <p className="text-xs text-muted-foreground truncate">{role.description}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{enabledCount} permission{enabledCount !== 1 ? 's' : ''}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role.id, role.name)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isExp && (
                  <div className="border-t bg-muted/20 px-4 py-3 grid grid-cols-2 gap-1.5">
                    {(Object.keys(PERMISSION_LABELS) as Array<keyof Permissions>).map(key => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${role.permissions[key] ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                        <span className={role.permissions[key] ? '' : 'text-muted-foreground/50'}>{PERMISSION_LABELS[key]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

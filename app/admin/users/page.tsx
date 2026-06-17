'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, ShieldCheck, KeyRound, Copy, Check, UserCheck, UserPlus,
  X, Mail, ChevronDown, ChevronUp, Building2, FlaskConical, Trash2, TriangleAlert,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface WorkspaceMembership {
  id: string
  name: string
  is_sandbox: boolean
  role: 'owner' | 'admin' | 'member'
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
  super_admin: boolean
  workspace_count: number
  workspaces: WorkspaceMembership[]
  updated_at: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  member: 'Member',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  admin: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  member: 'bg-muted text-muted-foreground border-border',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<{ userId: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [assuming, setAssuming] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null)
  const [roleMenuPos, setRoleMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteUserErr, setDeleteUserErr] = useState<string | null>(null)
  const [superAdminCount, setSuperAdminCount] = useState<number>(0)

  // Invite dialog state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null)

  const loadUsers = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        setUsers(data)
        setSuperAdminCount((data as UserRow[]).filter(u => u.super_admin).length)
        setLoading(false)
      })
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function toggleSuperAdmin(userId: string, current: boolean) {
    setToggling(userId)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ super_admin: !current }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, super_admin: !current } : u))
    }
    setToggling(null)
  }

  async function changeWorkspaceRole(userId: string, workspaceId: string, newRole: 'owner' | 'admin' | 'member') {
    const key = `${userId}:${workspaceId}`
    setChangingRole(key)
    setRoleMenuOpen(null)
    const res = await fetch(`/api/admin/users/${userId}/workspace-role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, workspaces: u.workspaces.map(w => w.id === workspaceId ? { ...w, role: newRole } : w) }
          : u
      ))
    }
    setChangingRole(null)
  }

  async function sendPasswordReset(userId: string) {
    setResetting(userId)
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'POST' })
    const data = await res.json()
    if (data.action_link) {
      setResetLink({ userId, link: data.action_link })
    }
    setResetting(null)
  }

  async function assumeIdentity(userId: string) {
    setAssuming(userId)
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    })
    if (res.ok) {
      window.location.href = '/dashboard'
    }
    setAssuming(null)
  }

  async function copyLink() {
    if (!resetLink) return
    await navigator.clipboard.writeText(resetLink.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteResult(null)
    const res = await fetch('/api/admin/invite-super-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteResult({
        ok: true,
        message: data.alreadyExisted
          ? `${inviteEmail} already exists — super_admin flag has been set.`
          : `Invite sent to ${inviteEmail}. They will receive an email to set up their account.`,
      })
      setInviteEmail('')
      loadUsers()
    } else {
      setInviteResult({ ok: false, message: data.error ?? 'Failed to send invite' })
    }
    setInviting(false)
  }

  async function deleteUser(userId: string) {
    setDeletingUser(true); setDeleteUserErr(null)
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setDeleteUserErr(data.error ?? 'Failed to delete user')
      setDeletingUser(false)
      return
    }
    setDeleteTarget(null)
    setDeletingUser(false)
    loadUsers()
  }

  // A user is an owner of a real workspace if any membership has role=owner and is not sandbox
  function isOwner(u: UserRow) {
    return u.workspaces.some(w => w.role === 'owner' && !w.is_sandbox)
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">{users.length} total users</p>
        </div>
        <Button
          onClick={() => { setShowInvite(true); setInviteResult(null) }}
          className="gap-2"
          size="sm"
        >
          <UserPlus className="h-4 w-4" />
          Invite Super Admin
        </Button>
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-400" />
              <p className="font-semibold text-sm">Invite Super Admin</p>
            </div>
            <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            The invited user will receive a setup email. Their account will be flagged as Super Admin
            immediately — they will have access to both the Admin Panel and the full OrbitAPI application.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="admin@yourcompany.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
                className="pl-9"
              />
            </div>
            <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()} className="gap-1.5 shrink-0">
              <UserPlus className="h-4 w-4" />
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </div>

          {inviteResult && (
            <div className={`rounded-lg p-3 text-sm ${inviteResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
              {inviteResult.message}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {resetLink && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-300">Password reset link generated</p>
            <button onClick={() => setResetLink(null)} className="text-muted-foreground hover:text-foreground text-xs">Dismiss</button>
          </div>
          <p className="text-xs text-muted-foreground break-all font-mono bg-muted/30 p-2 rounded">{resetLink.link}</p>
          <Button size="sm" variant="outline" onClick={copyLink} className="gap-2">
            {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${ROLE_COLORS.owner}`}>Owner</span>
          workspace creator
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${ROLE_COLORS.admin}`}>Administrator</span>
          can manage connectors &amp; members
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${ROLE_COLORS.member}`}>Member</span>
          chat only
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">No users found</div>
        )}
        {!loading && filtered.map((u, idx) => (
          <div key={u.id} className={idx > 0 ? 'border-t border-border' : ''}>
            {/* Main row */}
            <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/10 transition-colors">
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{u.full_name || u.email.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.super_admin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium border border-red-500/20">
                      SA
                    </span>
                  )}
                </div>
              </div>

              {/* Workspace expand toggle */}
              <button
                onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                {u.workspace_count} workspace{u.workspace_count !== 1 ? 's' : ''}
                {expandedUser === u.id
                  ? <ChevronUp className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3" />}
              </button>

              {/* Super admin toggle — locked when this is the last SA */}
              {(() => {
                const isLastSA = u.super_admin && superAdminCount <= 1
                return (
                  <button
                    onClick={() => !isLastSA && toggleSuperAdmin(u.id, u.super_admin)}
                    disabled={toggling === u.id || isLastSA}
                    title={isLastSA ? 'Cannot remove the last Super Admin' : u.super_admin ? 'Remove Super Admin' : 'Grant Super Admin'}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${u.super_admin
                        ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'}
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {toggling === u.id ? '…' : u.super_admin ? (isLastSA ? 'Last SA 🔒' : 'Super Admin') : 'Make SA'}
                  </button>
                )
              })()}

              {/* Password reset */}
              <button
                onClick={() => sendPasswordReset(u.id)}
                disabled={resetting === u.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <KeyRound className="h-3 w-3" />
                {resetting === u.id ? '…' : 'Reset pw'}
              </button>

              {/* Impersonate */}
              <button
                onClick={() => assumeIdentity(u.id)}
                disabled={assuming === u.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
              >
                <UserCheck className="h-3 w-3" />
                {assuming === u.id ? '…' : 'Assume'}
              </button>

              {/* Delete — disabled for owners */}
              <button
                onClick={() => { setDeleteTarget(u); setDeleteUserErr(null) }}
                disabled={isOwner(u)}
                title={isOwner(u) ? 'Cannot delete a workspace owner' : 'Delete user'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>

            {/* Expanded workspace list */}
            {expandedUser === u.id && (
              <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-2">
                {u.workspaces.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No workspace memberships.</p>
                ) : (
                  u.workspaces.map(ws => {
                    const roleKey = `${u.id}:${ws.id}`
                    const isChanging = changingRole === roleKey
                    const menuOpen = roleMenuOpen === roleKey

                    return (
                      <div key={ws.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {ws.is_sandbox
                            ? <FlaskConical className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                            : <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-sm truncate">{ws.name}</span>
                          {ws.is_sandbox && (
                            <span className="text-[10px] px-1.5 py-0 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 shrink-0">
                              Sandbox
                            </span>
                          )}
                        </div>

                        {/* Role picker */}
                        <div className="shrink-0">
                          <button
                            onClick={e => {
                              if (menuOpen) { setRoleMenuOpen(null); return }
                              const r = e.currentTarget.getBoundingClientRect()
                              setRoleMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                              setRoleMenuOpen(roleKey)
                            }}
                            disabled={isChanging}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors
                              hover:opacity-80 disabled:opacity-50 ${ROLE_COLORS[ws.role]}`}
                          >
                            {isChanging ? '…' : ROLE_LABELS[ws.role]}
                            <ChevronDown className="h-3 w-3" />
                          </button>

                          {/* Rendered in a portal so it's never clipped by the card's overflow */}
                          {menuOpen && roleMenuPos && createPortal(
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(null)} />
                              <div
                                className="fixed z-50 min-w-[150px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
                                style={{ top: roleMenuPos.top, right: roleMenuPos.right }}
                              >
                                {(['owner', 'admin', 'member'] as const).map(role => (
                                  <button
                                    key={role}
                                    onClick={() => changeWorkspaceRole(u.id, ws.id, role)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between
                                      ${ws.role === role ? 'font-semibold' : ''}`}
                                  >
                                    <span>{ROLE_LABELS[role]}</span>
                                    {ws.role === role && <Check className="h-3 w-3" />}
                                  </button>
                                ))}
                              </div>
                            </>,
                            document.body,
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <p className="text-[11px] text-muted-foreground pt-1 pb-0.5">
                  Role changes take effect immediately.
                  <span className="ml-1 text-muted-foreground/60">Owner → can&apos;t be reassigned here — transfer ownership from within the workspace.</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete user confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">Delete user account</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {deleteTarget.full_name || deleteTarget.email.split('@')[0]} · {deleteTarget.email}
                </p>
              </div>
              <button onClick={() => { setDeleteTarget(null); setDeleteUserErr(null) }} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-destructive text-sm">This action cannot be undone.</p>
              <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                <li>The user&apos;s account and profile will be permanently deleted</li>
                <li>All workspace memberships, skills, and conversations will be removed</li>
                <li>We do not retain any data after deletion — this is permanent</li>
              </ul>
            </div>

            {deleteUserErr && (
              <p className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                {deleteUserErr}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deletingUser}
                onClick={() => deleteUser(deleteTarget.id)}
              >
                {deletingUser ? 'Deleting…' : 'Yes, delete account'}
              </Button>
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteUserErr(null) }} disabled={deletingUser}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

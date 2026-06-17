'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Trash2, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface Props {
  email: string
  fullName: string
  userId: string
  connectionDeletePreference: 'trash' | 'permanent'
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark',  label: 'Dark',  icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ProfileForm({ email, fullName, userId, connectionDeletePreference }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  // Theme is only known on the client; guard against SSR hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [name, setName] = useState(fullName)
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Delete preference
  const [deletePref, setDeletePref] = useState<'trash' | 'permanent'>(connectionDeletePreference)
  const [savingPref, setSavingPref] = useState(false)
  const [prefMsg, setPrefMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Account deletion
  const [showDeleteStep1, setShowDeleteStep1] = useState(false)
  const [showDeleteStep2, setShowDeleteStep2] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || email[0]?.toUpperCase() || '?'

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true); setNameMsg(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    setSavingName(false)
    if (error) { setNameMsg({ type: 'err', text: error.message }); return }
    setNameMsg({ type: 'ok', text: 'Name updated.' })
    router.refresh()
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    if (newPw.length < 8) { setPwMsg({ type: 'err', text: 'Password must be at least 8 characters.' }); return }
    setSavingPw(true)
    // Re-authenticate first then update
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInErr) { setSavingPw(false); setPwMsg({ type: 'err', text: 'Current password is incorrect.' }); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) { setPwMsg({ type: 'err', text: error.message }); return }
    setPwMsg({ type: 'ok', text: 'Password changed successfully.' })
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
  }

  void userId

  async function saveDeletePref(pref: 'trash' | 'permanent') {
    setSavingPref(true); setPrefMsg(null)
    setDeletePref(pref)
    const res = await fetch('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_delete_preference: pref }),
    })
    setSavingPref(false)
    if (res.ok) {
      setPrefMsg({ type: 'ok', text: 'Preference saved.' })
    } else {
      const d = await res.json()
      setPrefMsg({ type: 'err', text: d.error ?? 'Failed to save.' })
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleting(true); setDeleteErr(null)
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword, confirmPhrase: deletePhrase }),
    })
    const data = await res.json()
    if (!res.ok) { setDeleting(false); setDeleteErr(data.error); return }
    // Signed out by deletion — redirect to login
    await supabase.auth.signOut()
    router.push('/login?deleted=true')
  }

  return (
    <div className="space-y-8">
      {/* Avatar + account info */}
      <div className="flex items-center gap-5 rounded-xl border p-6 bg-card">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-base">{name || '—'}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="text-xs text-muted-foreground mt-1">Account ID: {userId.slice(0, 8)}…</p>
        </div>
      </div>

      {/* Display name */}
      <section className="space-y-4 rounded-xl border p-6 bg-card">
        <div>
          <h2 className="font-semibold">Display name</h2>
          <p className="text-sm text-muted-foreground mt-0.5">This is shown in the sidebar and notifications.</p>
        </div>
        <form onSubmit={saveName} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="max-w-sm"
            />
          </div>
          {nameMsg && (
            <p className={`text-sm ${nameMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{nameMsg.text}</p>
          )}
          <Button type="submit" size="sm" disabled={savingName || name === fullName}>
            {savingName ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </section>

      {/* Email (read-only) */}
      <section className="space-y-4 rounded-xl border p-6 bg-card">
        <div>
          <h2 className="font-semibold">Email address</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your login email cannot be changed here.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={email} disabled className="max-w-sm bg-muted" />
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4 rounded-xl border p-6 bg-card">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how OrbitAPI looks on this device.</p>
        </div>
        <div className="flex gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 px-5 py-3.5 rounded-xl border text-sm font-medium transition-all
                  ${active
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                  }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Change password */}
      <section className="space-y-4 rounded-xl border p-6 bg-card">
        <div>
          <h2 className="font-semibold">Change password</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Use a strong password of at least 8 characters.</p>
        </div>
        <form onSubmit={changePassword} className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Current password</Label>
            <Input
              id="current-pw"
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{pwMsg.text}</p>
          )}
          <Button type="submit" size="sm" disabled={savingPw || !currentPw || !newPw || !confirmPw}>
            {savingPw ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </section>

      {/* Connection delete preference */}
      <section className="space-y-4 rounded-xl border p-6 bg-card">
        <div>
          <h2 className="font-semibold">Connection deletion behavior</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose what happens when you click &ldquo;Remove&rdquo; on a connection.
          </p>
        </div>
        <div className="flex gap-3">
          {([
            { value: 'trash', label: 'Move to Trash', desc: 'Kept for 7 days, then permanently deleted. You can restore during that time.' },
            { value: 'permanent', label: 'Delete Forever', desc: 'Immediately and permanently removes the connection and all its data.' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => saveDeletePref(opt.value)}
              disabled={savingPref}
              className={`flex-1 text-left p-4 rounded-xl border text-sm transition-all
                ${deletePref === opt.value
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs mt-1 leading-relaxed opacity-80">{opt.desc}</p>
            </button>
          ))}
        </div>
        {prefMsg && (
          <p className={`text-sm ${prefMsg.type === 'ok' ? 'text-emerald-500' : 'text-destructive'}`}>{prefMsg.text}</p>
        )}
        <p className="text-xs text-muted-foreground">Default is <strong>Move to Trash</strong>. You can always choose the other option at delete time.</p>
      </section>

      {/* Danger zone — account deletion */}
      <section className="space-y-4 rounded-xl border border-destructive/30 p-6 bg-card">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-destructive" />
          <h2 className="font-semibold text-destructive">Delete account</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Permanently deletes your account and all associated data including workspaces you own, connections,
          skills, conversations, and settings. <strong className="text-foreground">This cannot be undone.</strong> We
          do not retain any of your data after deletion.
        </p>

        {!showDeleteStep1 && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteStep1(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete my account
          </Button>
        )}

        {showDeleteStep1 && !showDeleteStep2 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-4">
            <p className="text-sm font-semibold text-destructive">Are you absolutely sure?</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
              <li>All your workspaces and their data will be deleted</li>
              <li>All connections, skills, and groups will be permanently removed</li>
              <li>All conversation history will be wiped</li>
              <li>We do not store any backup of your data after deletion</li>
              <li>This action is immediate and cannot be reversed</li>
            </ul>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteStep2(true)}
              >
                Yes, I understand — continue
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDeleteStep1(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showDeleteStep2 && (
          <form onSubmit={deleteAccount} className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Final confirmation</p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-pw" className="text-xs">Your current password</Label>
              <Input
                id="delete-pw"
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                required
                className="max-w-sm border-destructive/30 focus-visible:ring-destructive/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-phrase" className="text-xs">
                Type <strong>DELETE MY ACCOUNT</strong> to confirm
              </Label>
              <Input
                id="delete-phrase"
                value={deletePhrase}
                onChange={e => setDeletePhrase(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                required
                className="max-w-sm border-destructive/30 focus-visible:ring-destructive/40"
              />
            </div>
            {deleteErr && <p className="text-sm text-destructive">{deleteErr}</p>}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={deleting || deletePhrase !== 'DELETE MY ACCOUNT' || !deletePassword}
              >
                {deleting ? 'Deleting…' : 'Permanently delete my account'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setShowDeleteStep2(false); setShowDeleteStep1(false); setDeletePassword(''); setDeletePhrase(''); setDeleteErr(null) }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

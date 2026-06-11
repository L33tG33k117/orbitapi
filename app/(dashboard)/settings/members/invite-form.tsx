'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/workspaces/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, email, role }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to invite member')
    } else {
      setSuccess(`Invited ${email}`)
      setEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Invite a member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" placeholder="colleague@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-role">Role</Label>
            <select
              id="inv-role"
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'member')}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>{loading ? 'Inviting…' : 'Invite'}</Button>
        </form>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
      </CardContent>
    </Card>
  )
}

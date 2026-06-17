'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus } from 'lucide-react'

interface CustomRole {
  id: string
  name: string
}

export function InviteMemberForm({
  workspaceId,
  customRoles,
}: {
  workspaceId: string
  customRoles: CustomRole[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [roleValue, setRoleValue] = useState('member::')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const [role, customRoleId] = roleValue.split('::')

    const res = await fetch('/api/workspaces/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        email,
        role,
        customRoleId: customRoleId || undefined,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to invite member')
    } else {
      setSuccess(`Invited ${email}`)
      setEmail('')
      setRoleValue('member::')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Invite a member</h2>
      </div>
      <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-48 space-y-1.5">
          <Label htmlFor="inv-email" className="text-xs">Email address</Label>
          <Input
            id="inv-email"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5 min-w-48">
          <Label htmlFor="inv-role" className="text-xs">Role</Label>
          <select
            id="inv-role"
            value={roleValue}
            onChange={e => setRoleValue(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="admin::">Administrator — full workspace access</option>
            <option value="member::">User — access controlled per connection</option>
            {customRoles.map(cr => (
              <option key={cr.id} value={`member::${cr.id}`}>{cr.name} — custom role</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? 'Inviting…' : 'Invite'}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      {success && <p className="text-sm text-emerald-500 mt-3">{success}</p>}
    </div>
  )
}

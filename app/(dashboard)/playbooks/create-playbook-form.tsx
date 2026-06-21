'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ShieldAlert } from 'lucide-react'

interface Group { id: string; name: string; color: string }

// Starter templates seed a sensible step graph so a new playbook is runnable
// immediately rather than starting blank.
const STARTERS: Record<string, { label: string; persona: string; steps: unknown[] }> = {
  triage: {
    label: 'Assess → act by confidence',
    persona: 'You are a security operations analyst triaging incoming signals.',
    steps: [
      { id: 'assess', name: 'Assess the situation', type: 'assess', prompt: 'Review current alerts/detections and score your confidence 0–10.', next: 'act' },
      { id: 'act', name: 'Take remediation action', type: 'action', next: 'notify' },
      { id: 'notify', name: 'Notify the team', type: 'notify', message: 'Playbook handled at confidence {{state.severity}}: {{state.assessment}}' },
    ],
  },
  blank: { label: 'Blank (add steps later)', persona: '', steps: [] },
}

export function CreatePlaybookForm({ groups }: { groups: Group[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [starter, setStarter] = useState<keyof typeof STARTERS>('triage')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const s = STARTERS[starter]
    const res = await fetch('/api/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        group_id: groupId || null,
        persona: s.persona,
        definition: { steps: s.steps },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Could not create playbook')
      setLoading(false)
      return
    }
    toast.success('Playbook created')
    router.push(`/playbooks/${data.id}`)
  }

  if (!open) return <Button onClick={() => setOpen(true)}>New playbook</Button>

  return (
    <form onSubmit={handleSubmit} className="border rounded-xl p-4 space-y-4 bg-card">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h2 className="font-medium">Create playbook</h2>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pname">Name</Label>
        <Input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="Critical host isolation" required autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pgroup">Group (its connections power the steps)</Label>
        <select id="pgroup" value={groupId} onChange={e => setGroupId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">No group — uses all connections</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pstart">Start from</Label>
        <select id="pstart" value={starter} onChange={e => setStarter(e.target.value as keyof typeof STARTERS)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(STARTERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim()}>{loading ? 'Creating…' : 'Create'}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

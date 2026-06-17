'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'

interface Item { id: string; name: string }

export function PublishForm({ playbooks, skills }: { playbooks: Item[]; skills: Item[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [pbIds, setPbIds] = useState<string[]>([])
  const [skIds, setSkIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
    const res = await fetch('/api/marketplace', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), slug, category, description, price_usd: Number(price) || 0, playbookIds: pbIds, skillIds: skIds }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Publish failed'); return }
    toast.success('Submitted for review')
    setOpen(false); setName(''); setDescription(''); setPbIds([]); setSkIds([])
    router.refresh()
  }

  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}><Upload className="h-3.5 w-3.5" /> Publish a bundle</Button>

  return (
    <form onSubmit={submit} className="border rounded-xl p-4 bg-card space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="mname">Name</Label>
          <Input id="mname" value={name} onChange={e => setName(e.target.value)} placeholder="Daily Threat Briefing" required /></div>
        <div className="space-y-1.5"><Label htmlFor="mcat">Category</Label>
          <Input id="mcat" value={category} onChange={e => setCategory(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="mdesc">Description</Label>
        <textarea id="mdesc" value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="space-y-1.5"><Label htmlFor="mprice">Price (USD, 0 = free)</Label>
        <Input id="mprice" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className="w-32" /></div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold mb-1.5">Playbooks</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {playbooks.length === 0 && <p className="text-[11px] text-muted-foreground">None to publish.</p>}
            {playbooks.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={pbIds.includes(p.id)} onChange={() => toggle(pbIds, setPbIds, p.id)} /> {p.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-1.5">Skills</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {skills.length === 0 && <p className="text-[11px] text-muted-foreground">None to publish.</p>}
            {skills.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={skIds.includes(s.id)} onChange={() => toggle(skIds, setSkIds, s.id)} /> {s.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">Credentials are never included. Connections are exported as connector references only.</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim()}>{loading ? 'Submitting…' : 'Submit for review'}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

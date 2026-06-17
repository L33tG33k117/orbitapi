'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { WorkspaceTier } from '@/types'

interface WorkspaceRow {
  id: string
  name: string
  tier: WorkspaceTier
  owner_email: string | null
  member_count: number
  connection_count: number
  skill_count: number
  monthly_credits: number
  credits_overridden: boolean
  created_at: string
}

const TIER_STYLES: Record<WorkspaceTier, string> = {
  free: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  starter: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  pro: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  enterprise: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/workspaces')
      .then(r => r.json())
      .then(data => { setWorkspaces(data); setLoading(false) })
  }, [])

  async function changeTier(id: string, tier: WorkspaceTier) {
    setSaving(id)
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    if (res.ok) {
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, tier } : w))
    }
    setSaving(null)
  }

  const filtered = workspaces.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.owner_email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground mt-1">{workspaces.length} total workspaces</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or owner email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Workspace</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">AI credits / mo</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Members</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Connections</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Skills</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No workspaces found</td>
              </tr>
            )}
            {filtered.map(ws => (
              <tr key={ws.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-medium">{ws.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{ws.owner_email ?? '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={ws.tier}
                    disabled={saving === ws.id}
                    onChange={e => changeTier(ws.id, e.target.value as WorkspaceTier)}
                    className={`text-xs px-2 py-1 rounded-full border font-medium capitalize cursor-pointer bg-transparent outline-none ${TIER_STYLES[ws.tier]} disabled:opacity-50`}
                  >
                    <option value="free">free</option>
                    <option value="starter">starter</option>
                    <option value="pro">pro</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {ws.monthly_credits.toLocaleString()}
                    {ws.credits_overridden && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold uppercase tracking-wide">custom</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{ws.member_count}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{ws.connection_count}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{ws.skill_count}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/workspaces/${ws.id}`}
                    className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

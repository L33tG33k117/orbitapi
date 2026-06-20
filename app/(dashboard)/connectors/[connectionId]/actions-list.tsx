'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'

type Risk = 'read' | 'write' | 'destructive'
interface ActionItem { slug: string; name: string; risk: string }

const FILTERS: { key: 'all' | Risk; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'read', label: 'Read' },
  { key: 'write', label: 'Write' },
  { key: 'destructive', label: 'Destructive' },
]

export function ActionsList({ actions }: { actions: ActionItem[] }) {
  const [filter, setFilter] = useState<'all' | Risk>('all')

  const counts = useMemo(() => ({
    all: actions.length,
    read: actions.filter(a => a.risk === 'read').length,
    write: actions.filter(a => a.risk === 'write').length,
    destructive: actions.filter(a => a.risk === 'destructive').length,
  }), [actions])

  const visible = filter === 'all' ? actions : actions.filter(a => a.risk === filter)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>
      <div className="border rounded-lg divide-y">
        {visible.map(a => (
          <div key={a.slug} className="px-4 py-3 flex items-start gap-3">
            <Badge
              variant={a.risk === 'read' ? 'outline' : a.risk === 'write' ? 'secondary' : 'destructive'}
              className="text-xs mt-0.5 shrink-0"
            >
              {a.risk}
            </Badge>
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{a.slug}</p>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No {filter} actions.</p>
        )}
      </div>
    </div>
  )
}

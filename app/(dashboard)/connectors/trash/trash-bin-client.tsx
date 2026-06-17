'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Trash2, RotateCcw, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TrashedConnection {
  id: string
  label: string
  trashed_at: string
  connector: { slug: string; name: string; category: string } | null
}

function daysLeft(trashedAt: string): number {
  const expiry = new Date(trashedAt).getTime() + 7 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function TrashBinClient({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<TrashedConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/connections/trash')
    const data = await res.json()
    setItems(data.trashed ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function restore(id: string) {
    setRestoring(id)
    await fetch(`/api/connections/${id}/restore`, { method: 'POST' })
    setItems(prev => prev.filter(i => i.id !== id))
    setRestoring(null)
  }

  async function permanentDelete(id: string) {
    setDeleting(id)
    setConfirmDelete(null)
    await fetch(`/api/connections/${id}?mode=permanent`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        Loading trash…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center">
          <Trash2 className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-muted-foreground">Trash is empty</p>
        <p className="text-sm text-muted-foreground/70">Deleted connections appear here for 7 days before being permanently removed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const remaining = daysLeft(item.trashed_at)
        const isUrgent = remaining <= 1

        return (
          <div
            key={item.id}
            className={`rounded-xl border p-4 flex items-center gap-4 transition-colors
              ${isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}
          >
            {/* Logo */}
            <div className="shrink-0 relative">
              <Image
                src={`/logos/${item.connector?.slug ?? 'default'}.svg`}
                alt={item.connector?.name ?? ''}
                width={36}
                height={36}
                className="rounded-lg grayscale opacity-60"
                unoptimized
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-muted-foreground line-through">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.connector?.name} · {item.connector?.category}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="h-3 w-3" />
                {remaining === 0
                  ? 'Deletes today'
                  : `${remaining} day${remaining !== 1 ? 's' : ''} until permanent deletion`}
              </div>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={restoring === item.id}
                  onClick={() => restore(item.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoring === item.id ? 'Restoring…' : 'Restore'}
                </Button>

                {confirmDelete === item.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-destructive">Permanently delete?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      disabled={deleting === item.id}
                      onClick={() => permanentDelete(item.id)}
                    >
                      {deleting === item.id ? '…' : 'Yes, delete'}
                    </Button>
                    <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete now
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground text-center pt-2">
        {items.length} item{items.length !== 1 ? 's' : ''} in trash · Connections are permanently removed after 7 days
      </p>
    </div>
  )
}

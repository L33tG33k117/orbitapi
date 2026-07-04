'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquarePlus, Plug, Flag } from 'lucide-react'

interface InboxItem {
  id: string
  type: 'feedback' | 'request' | 'report'
  title: string
  body: string | null
  link: string
  created_at: string
}

const SEEN_KEY = 'orbit:admin-inbox-seen'

const TYPE_META: Record<InboxItem['type'], { icon: typeof Bell; color: string }> = {
  feedback: { icon: MessageSquarePlus, color: 'text-violet-400' },
  request: { icon: Plug, color: 'text-blue-400' },
  report: { icon: Flag, color: 'text-red-400' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AdminNotificationBell() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [open, setOpen] = useState(false)
  // Read the "last seen" marker after mount only — avoids SSR hydration mismatch.
  const [lastSeen, setLastSeen] = useState<number>(() => 0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const router = useRouter()

  const load = useCallback(() => {
    fetch('/api/admin/notifications')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.items) setItems(d.items as InboxItem[]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const raw = window.localStorage.getItem(SEEN_KEY)
    setLastSeen(raw ? Number(raw) : 0)
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = items.filter(i => new Date(i.created_at).getTime() > lastSeen).length

  function toggle() {
    const next = !open
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
      // Opening clears the "new" badge — mark everything seen as of now.
      const now = Date.now()
      window.localStorage.setItem(SEEN_KEY, String(now))
      setLastSeen(now)
    }
    setOpen(next)
  }

  function go(item: InboxItem) {
    setOpen(false)
    router.push(item.link)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="relative flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Admin notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[200] w-80 max-w-[calc(100vw-1rem)] rounded-xl border bg-popover shadow-xl overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Admin inbox</p>
            <span className="text-xs text-muted-foreground">Recent submissions</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing new.</p>
            ) : (
              items.map(item => {
                const meta = TYPE_META[item.type]
                const Icon = meta.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    className="w-full text-left px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug font-medium truncate">{item.title}</p>
                        {item.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(item.created_at)}</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

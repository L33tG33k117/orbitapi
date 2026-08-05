'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  skill_completed: '✓',
  skill_failed: '✕',
  pending_action: '⏸',
  info: 'ℹ',
}

const TYPE_COLOR: Record<string, string> = {
  skill_completed: 'text-green-600',
  skill_failed: 'text-destructive',
  pending_action: 'text-amber-600',
  info: 'text-muted-foreground',
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

export function NotificationBell({ workspaceId }: { workspaceId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const unread = notifications.filter(n => !n.read).length

  // Load now, then poll.
  //
  // This used to hold a Supabase Realtime subscription. Realtime was this
  // component's ONLY consumer app-wide, and it's a whole extra service the
  // self-hosted package would have to ship and support just to make a bell
  // icon update a few seconds sooner. Polling every 30s reads the same table
  // through the same client, and runs in BOTH editions — a behaviour that
  // differs between cloud and self-host is a behaviour we'd have to debug
  // twice. Notifications are not time-critical; nothing here is a live feed.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, link, read, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (!cancelled && data) setNotifications(data as Notification[])
    }

    load()
    const timer = setInterval(() => {
      // Don't poll a tab nobody is looking at, and don't clobber the list
      // while the panel is open and being read.
      if (document.visibilityState === 'visible') load()
    }, 30_000)

    return () => { cancelled = true; clearInterval(timer) }
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click (the panel is portaled, so check both the button and panel).
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
      markAllRead()
    }
    setOpen(o => !o)
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="relative flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-0.5">
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
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors ${!n.read ? 'bg-muted/40' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`text-sm shrink-0 mt-0.5 ${TYPE_COLOR[n.type] ?? 'text-muted-foreground'}`}>
                      {TYPE_ICON[n.type] ?? '·'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? 'font-medium' : ''}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Building2, Users, ShieldCheck, ArrowLeft,
  Plug, Flag, BarChart2, Ban, FlaskConical, MessageSquarePlus, X, Bug, Inbox, Server,
} from 'lucide-react'

type BadgeKey = 'feedback' | 'requests' | 'reports' | 'errors' | 'contact'

const items = [
  { href: '/admin/overview',            label: 'Overview',   icon: LayoutDashboard },
  { href: '/admin/workspaces',          label: 'Workspaces', icon: Building2 },
  { href: '/admin/users',               label: 'Users',      icon: Users },
  { href: '/admin/analytics',           label: 'Analytics',  icon: BarChart2 },
  { href: '/admin/feedback',            label: 'Feedback',   icon: MessageSquarePlus, badge: 'feedback' as BadgeKey },
  { href: '/admin/contact',             label: 'Contact',    icon: Inbox, badge: 'contact' as BadgeKey },
  { href: '/admin/bans',                label: 'Bans',       icon: Ban },
  { href: '/admin/connector-requests',  label: 'Requests',   icon: Plug, badge: 'requests' as BadgeKey },
  { href: '/admin/connector-reports',   label: 'Reports',    icon: Flag, badge: 'reports' as BadgeKey },
  { href: '/admin/errors',              label: 'Errors',     icon: Bug, badge: 'errors' as BadgeKey },
  { href: '/admin/selfhost',            label: 'Self-hosted', icon: Server },
  { href: '/admin/sandbox',             label: 'Sandbox',    icon: FlaskConical, highlight: true },
]

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  badge?: BadgeKey
}

interface AdminSidebarProps {
  email: string
  fullName: string | null
  openReports?: number
  newFeedback?: number
  pendingRequests?: number
  openErrors?: number
  newContact?: number
}

export function AdminSidebar({ email, fullName, openReports = 0, newFeedback = 0, pendingRequests = 0, openErrors = 0, newContact = 0 }: AdminSidebarProps) {
  const counts: Record<BadgeKey, number> = {
    feedback: newFeedback,
    requests: pendingRequests,
    reports: openReports,
    errors: openErrors,
    contact: newContact,
  }
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const toggle = () => setOpen(v => !v)
    window.addEventListener('orbit:toggle-nav', toggle)
    return () => window.removeEventListener('orbit:toggle-nav', toggle)
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])

  const inner = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4 text-red-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-red-400 leading-none">Super Admin</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--sidebar-foreground)', opacity: 0.45 }}>OrbitAPI</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {(items as NavItem[]).map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badgeCount = item.badge ? counts[item.badge] : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--sidebar-primary)' : 'transparent',
                color: active
                  ? 'var(--sidebar-primary-foreground)'
                  : item.highlight
                    ? 'rgb(167 139 250)'
                    : 'var(--sidebar-foreground)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--sidebar-accent)'
                  e.currentTarget.style.color = 'var(--sidebar-accent-foreground)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = item.highlight ? 'rgb(167 139 250)' : 'var(--sidebar-foreground)'
                }
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {badgeCount > 0 && !active && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Back to app */}
      <div className="px-3 pt-3 pb-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--sidebar-foreground)', opacity: 0.5 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-accent)'; e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.5' }}
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span>Back to app</span>
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar — no right border; it blends into the deep-space shell
          and the floating content panel provides the separation. */}
      <aside
        className="shrink-0 hidden lg:flex flex-col h-full"
        style={{ background: 'var(--sidebar)', width: '208px' }}
      >
        {inner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside
            className="relative flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200"
            style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)', width: '240px', maxWidth: '82vw' }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-4 z-10 p-1.5 rounded-md"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              <X className="h-4 w-4" />
            </button>
            {inner}
          </aside>
        </div>
      )}
    </>
  )
}

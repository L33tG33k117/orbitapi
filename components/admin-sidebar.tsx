'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Users, ShieldCheck, ArrowLeft,
  Plug, Flag, BarChart2, Ban, FlaskConical, MessageSquarePlus,
} from 'lucide-react'

const items = [
  { href: '/admin/overview',            label: 'Overview',   icon: LayoutDashboard },
  { href: '/admin/workspaces',          label: 'Workspaces', icon: Building2 },
  { href: '/admin/users',               label: 'Users',      icon: Users },
  { href: '/admin/analytics',           label: 'Analytics',  icon: BarChart2 },
  { href: '/admin/feedback',            label: 'Feedback',   icon: MessageSquarePlus },
  { href: '/admin/bans',                label: 'Bans',       icon: Ban },
  { href: '/admin/connector-requests',  label: 'Requests',   icon: Plug },
  { href: '/admin/connector-reports',   label: 'Reports',    icon: Flag },
  { href: '/admin/sandbox',             label: 'Sandbox',    icon: FlaskConical, highlight: true },
]

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
}

interface AdminSidebarProps {
  email: string
  fullName: string | null
  openReports?: number
}

export function AdminSidebar({ email, fullName, openReports = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="w-52 shrink-0 flex flex-col h-full"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)', width: '208px' }}
    >
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
              {item.href === '/admin/connector-reports' && openReports > 0 && !active && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {openReports}
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
    </aside>
  )
}

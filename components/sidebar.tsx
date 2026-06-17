'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole, FeatureFlags, WorkspaceTier } from '@/types'
import { cn } from '@/lib/utils'
import { hasCapability, type Capability } from '@/lib/entitlements'
import {
  LayoutDashboard, Plug, Layers, Zap, MessageSquare, ScrollText, Users, Settings,
  Orbit, ShieldCheck, CreditCard, Search, BarChart2, ClipboardCheck, Inbox, BookOpen, Trash2,
  ShieldAlert, Package, Webhook, Gauge, Sparkles, Shuffle, LifeBuoy, Lock,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  indent?: boolean
  excludeStartsWith?: string | string[]
  capability?: Capability
}

interface NavSection {
  label?: string
  items: NavItem[]
}

// Grouped navigation — sections keep a large feature set calm and scannable.
const sections: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/chat', label: 'Orbit Assistant', icon: MessageSquare },
      { href: '/guide', label: 'Help Guide', icon: LifeBuoy },
    ],
  },
  {
    label: 'Connect',
    items: [
      { href: '/connectors', label: 'API Connectors', icon: Plug, excludeStartsWith: ['/connectors/requests', '/connectors/trash', '/connectors/discover'] },
      { href: '/connectors/requests', label: 'Requests', icon: Inbox, indent: true },
      { href: '/connectors/discover', label: 'Discover', icon: Sparkles, indent: true, capability: 'discover' },
      { href: '/connectors/trash', label: 'Trash', icon: Trash2, indent: true },
      { href: '/groups', label: 'Groups', icon: Layers },
    ],
  },
  {
    label: 'Automate',
    items: [
      { href: '/skills', label: 'Skills', icon: Zap, capability: 'skills' },
      { href: '/playbooks', label: 'Playbooks', icon: ShieldAlert, capability: 'playbooks' },
      { href: '/data-mapping', label: 'Data Mapping', icon: Shuffle, capability: 'data_mapping' },
      { href: '/bundles', label: 'Bundles', icon: Package, capability: 'bundles' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
      { href: '/webhooks', label: 'Webhooks', icon: Webhook, capability: 'webhooks' },
      { href: '/reference', label: 'API Reference', icon: BookOpen, capability: 'api_reference' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/usage', label: 'Usage', icon: BarChart2 },
      { href: '/ai-power', label: 'AI Power', icon: Gauge },
      { href: '/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
]

const adminItems: NavItem[] = [
  { href: '/settings/members', label: 'Members', icon: Users },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/workspace', label: 'Workspace', icon: Settings },
]

interface SidebarProps {
  workspace: { name: string; id: string }
  role: UserRole
  tier: WorkspaceTier
  flags: FeatureFlags
  superAdmin?: boolean
  pendingApprovals?: number
  unreadConnectorMessages?: number
}

export function Sidebar({ workspace, role, tier, flags, superAdmin, pendingApprovals, unreadConnectorMessages }: SidebarProps) {
  const pathname = usePathname()

  function isPathActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }
  function isActive(item: NavItem) {
    if (!isPathActive(item.href)) return false
    if (item.excludeStartsWith) {
      const list = Array.isArray(item.excludeStartsWith) ? item.excludeStartsWith : [item.excludeStartsWith]
      if (list.some(p => isPathActive(p))) return false
    }
    return true
  }

  function renderItem(item: NavItem) {
    const active = isActive(item)
    const Icon = item.icon
    const locked = !!item.capability && !hasCapability(tier, flags, item.capability)
    const badge =
      item.href === '/approvals' ? (pendingApprovals ?? 0) :
      item.href === '/connectors/requests' ? (unreadConnectorMessages ?? 0) : 0

    return (
      <Link
        key={item.href}
        href={item.href}
        title={locked ? 'Upgrade to unlock' : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-lg font-medium transition-all duration-150',
          item.indent ? 'ml-3.5 px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-2 text-sm',
          active
            ? 'text-white shadow-[0_6px_18px_-8px_var(--brand-to)]'
            : locked
              ? 'text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          active && !item.indent && 'bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)]',
          active && item.indent && 'bg-sidebar-accent !text-sidebar-accent-foreground',
        )}
      >
        {active && !item.indent && (
          <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-gradient-to-b from-[var(--brand-from)] to-[var(--brand-to)]" />
        )}
        <Icon className={cn('shrink-0', item.indent ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]')} />
        <span className="flex-1 truncate">{item.label}</span>
        {locked
          ? <Lock className="h-3 w-3 shrink-0 opacity-60" />
          : badge > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
                {badge}
              </span>
            )}
      </Link>
    )
  }

  return (
    <aside
      className="orbit-stars w-[236px] flex flex-col h-full shrink-0 bg-sidebar"
      style={{ borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] shadow-[0_4px_16px_-4px_var(--brand-to)]">
          <Orbit className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[15px] tracking-tight text-gradient">OrbitAPI</span>
          <p className="text-[11px] truncate text-sidebar-foreground/50 mt-px">{workspace.name}</p>
        </div>
      </div>

      {/* Search / Cmd+K */}
      <div className="px-3 py-2.5">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs bg-sidebar-accent/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono opacity-60">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {sections.map((section, i) => (
          <div key={section.label ?? i} className={cn(section.label && 'pt-3')}>
            {section.label && (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/35">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}

        {(role === 'owner' || role === 'admin') && (
          <div className="pt-3">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/35">Settings</p>
            <div className="space-y-0.5">{adminItems.map(renderItem)}</div>
          </div>
        )}

        {superAdmin && (
          <div className="pt-3">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-400/50">Super Admin</p>
            <Link
              href="/admin/overview"
              className={cn(
                'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isPathActive('/admin')
                  ? 'bg-red-500/15 text-red-300'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-red-400" />
              <span className="truncate">Admin Panel</span>
            </Link>
          </div>
        )}
      </nav>
    </aside>
  )
}

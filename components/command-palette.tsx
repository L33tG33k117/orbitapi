'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Plug, Layers, Zap, MessageSquare, ScrollText,
  Users, Settings, Search, ArrowRight, CreditCard, ShieldCheck,
  Plus, Activity,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof Search
  href?: string
  action?: () => void
  group: string
  keywords?: string[]
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items: CommandItem[] = [
    // Navigate
    { id: 'dashboard', label: 'Overview', description: 'Go to dashboard', icon: LayoutDashboard, href: '/dashboard', group: 'Navigate' },
    { id: 'connectors', label: 'Connectors', description: 'Manage API connections', icon: Plug, href: '/connectors', group: 'Navigate', keywords: ['api', 'integration', 'connect'] },
    { id: 'groups', label: 'Groups', description: 'Manage connection groups', icon: Layers, href: '/groups', group: 'Navigate' },
    { id: 'skills', label: 'Skills', description: 'View and manage skills', icon: Zap, href: '/skills', group: 'Navigate', keywords: ['automation', 'agent', 'workflow'] },
    { id: 'chat', label: 'Orbit Assistant', description: 'Open AI chat', icon: MessageSquare, href: '/chat', group: 'Navigate', keywords: ['ai', 'chat', 'assistant', 'ask'] },
    { id: 'audit', label: 'Audit Log', description: 'View all API actions', icon: ScrollText, href: '/audit', group: 'Navigate', keywords: ['log', 'history', 'actions'] },
    // Quick actions
    { id: 'new-skill', label: 'Create new skill', description: 'Build an AI automation', icon: Plus, href: '/skills', group: 'Quick actions', keywords: ['new', 'add', 'skill', 'create'] },
    { id: 'add-connector', label: 'Connect an API', description: 'Add a new connector', icon: Plug, href: '/connectors', group: 'Quick actions', keywords: ['new', 'add', 'connect', 'api'] },
    { id: 'open-chat', label: 'Ask Orbit Assistant', description: 'Chat with your APIs', icon: MessageSquare, href: '/chat', group: 'Quick actions', keywords: ['ai', 'ask', 'query'] },
    // Settings
    { id: 'settings-profile', label: 'Profile & appearance', icon: Settings, href: '/settings/profile', group: 'Settings', keywords: ['theme', 'dark', 'profile', 'name'] },
    { id: 'settings-members', label: 'Members', icon: Users, href: '/settings/members', group: 'Settings', keywords: ['team', 'invite', 'user'] },
    { id: 'settings-billing', label: 'Billing & plan', icon: CreditCard, href: '/settings/billing', group: 'Settings', keywords: ['plan', 'upgrade', 'subscription', 'payment'] },
    { id: 'upgrade', label: 'Upgrade plan', description: 'View pricing and upgrade', icon: Activity, href: '/upgrade', group: 'Settings', keywords: ['pro', 'starter', 'enterprise', 'plan'] },
    { id: 'admin', label: 'Admin panel', description: 'Super admin only', icon: ShieldCheck, href: '/admin/overview', group: 'Admin', keywords: ['admin', 'super'] },
  ]

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.includes(q))
        )
      })
    : items

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  const flatFiltered = Object.values(grouped).flat()

  const execute = useCallback((item: CommandItem) => {
    setOpen(false)
    setQuery('')
    if (item.action) item.action()
    else if (item.href) router.push(item.href)
  }, [router])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setActiveIndex(0)
      }
      if (!open) return
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, flatFiltered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && flatFiltered[activeIndex]) {
        execute(flatFiltered[activeIndex])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flatFiltered, activeIndex, execute])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  let globalIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {flatFiltered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
          )}
          {Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group}>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group}
              </p>
              {groupItems.map(item => {
                globalIndex++
                const idx = globalIndex
                const Icon = item.icon
                const isActive = activeIndex === idx
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    {isActive && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono border border-border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono border border-border rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono border border-border rounded px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

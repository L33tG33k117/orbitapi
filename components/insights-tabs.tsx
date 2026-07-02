'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Activity, BarChart2, ScrollText } from 'lucide-react'

// The three "what happened" views are one section, not three choices. This
// switcher sits under the hero on each so users can flip between them without
// going back to the sidebar: Activity = friendly feed (default), Usage =
// charts, Audit Log = the formal record.
const VIEWS = [
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/usage', label: 'Usage', icon: BarChart2 },
  { href: '/audit', label: 'Audit Log', icon: ScrollText },
]

export function InsightsTabs() {
  const pathname = usePathname()
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
      {VIEWS.map(v => {
        const active = pathname === v.href || pathname.startsWith(v.href + '/')
        const Icon = v.icon
        return (
          <Link
            key={v.href}
            href={v.href}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </Link>
        )
      })}
    </div>
  )
}

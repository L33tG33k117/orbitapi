'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/connectors', label: 'Connectors' },
  { href: '/chat', label: 'Orbit Assistant' },
  { href: '/automations', label: 'Automations' },
  { href: '/audit', label: 'Audit Log' },
]

const adminItems = [
  { href: '/settings/members', label: 'Members' },
  { href: '/settings/workspace', label: 'Workspace' },
]

interface SidebarProps {
  workspace: { name: string; id: string }
  role: UserRole
  user: User
}

export function Sidebar({ workspace, role, user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (user.user_metadata?.full_name as string | undefined)
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase() ?? user.email?.[0].toUpperCase() ?? '?'

  return (
    <aside className="w-56 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">OrbitAPI</span>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{workspace.name}</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {item.label}
          </Link>
        ))}
        {(role === 'owner' || role === 'admin') && (
          <>
            <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Admin
            </div>
            {adminItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 rounded-md text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="p-3 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate">{(user.user_metadata?.full_name as string) ?? user.email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/notification-bell'
import { AdminNotificationBell } from '@/components/admin-notification-bell'
import { NavHotkeys } from '@/components/nav-hotkeys'
import { ThemeToggle } from '@/components/theme-toggle'
import { FeedbackButton } from '@/components/feedback-button'
import { PageTour } from '@/components/page-tour'
import { LaunchTray } from '@/components/launch-tray'
import { LogOut, User as UserIcon, Settings, ChevronDown, Menu } from 'lucide-react'

interface TopBarProps {
  user: User
  role: UserRole
  workspaceId: string
  impersonating?: { id: string; name: string; email: string } | null
  /** Show the Super Admin inbox bell instead of the workspace notification bell. */
  adminInbox?: boolean
}

export function TopBar({ user, role, workspaceId, impersonating, adminInbox }: TopBarProps) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function exitImpersonation() {
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    router.refresh()
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ''
  const initials = displayName.split(/[\s@]/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const roleLabel = role === 'owner' ? 'Owner' : role === 'admin' ? 'Administrator' : 'User'

  return (
    <div className="flex items-center justify-end gap-1 px-4 py-2.5 border-b border-border/60 glass shrink-0">
      {/* Mobile menu trigger + brand (sidebar is hidden under lg) */}
      <div className="lg:hidden mr-auto flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new Event('orbit:toggle-nav'))}
          aria-label="Open menu"
          className="p-2 -ml-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" aria-label="OrbitAPI home" className="font-bold text-sm tracking-tight text-gradient">OrbitAPI</Link>
      </div>

      {impersonating && (
        <div className="flex items-center gap-2 mr-auto">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-300">
              Viewing as <span className="font-bold">{impersonating.name || impersonating.email}</span>
            </span>
            <button
              onClick={exitImpersonation}
              className="ml-1 text-[11px] font-semibold text-amber-300 hover:text-amber-100 underline underline-offset-2"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      <NavHotkeys />
      <PageTour />
      <LaunchTray />
      <FeedbackButton />
      <ThemeToggle />
      {adminInbox
        ? <AdminNotificationBell />
        : workspaceId && <NotificationBell workspaceId={workspaceId} />}

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors outline-none">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-medium leading-none truncate max-w-[120px]">{displayName.split('@')[0]}</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{roleLabel}</p>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-medium truncate">{displayName}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          <DropdownMenuItem onClick={() => router.push('/settings/profile')} className="gap-2">
            <UserIcon className="h-3.5 w-3.5" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings/workspace')} className="gap-2">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

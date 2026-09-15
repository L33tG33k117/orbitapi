'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CloudOff } from 'lucide-react'
import { isOfflinePausedPath, OFFLINE_PAUSED_MESSAGE } from '@/lib/offline-paths'

// Wraps dashboard pages. When the workspace is in offline mode, shows a banner
// everywhere and replaces paused pages (connections, automations, assistant)
// with an explanation, so nobody edits something here expecting it to reach
// the offline install.
export function OfflineModeShell({ active, canManage, children }: {
  active: boolean
  canManage: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (!active) return <>{children}</>
  const paused = isOfflinePausedPath(pathname)

  return (
    <>
      <div className="print:hidden flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="font-semibold">Offline mode is on.</span> Your automations run on your self-hosted install. Changes made here don&apos;t reach it.
        </span>
        {canManage && (
          <Link href="/settings/downloads#offline-mode" className="font-semibold underline underline-offset-2 hover:text-amber-100">
            Manage offline mode
          </Link>
        )}
      </div>
      {paused ? (
        <div className="p-4 sm:p-8">
          <div className="max-w-lg mx-auto mt-16 border rounded-xl p-8 text-center space-y-3 bg-card">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <CloudOff className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-semibold">Paused while offline</h1>
            <p className="text-sm text-muted-foreground">{OFFLINE_PAUSED_MESSAGE}</p>
            <p className="text-sm text-muted-foreground">
              Use this page on your self-hosted install instead.
              {canManage ? ' To use it here again, switch the workspace back to online mode.' : ' A workspace admin can switch back to online mode.'}
            </p>
            <div className="flex justify-center gap-4 pt-2 text-sm">
              <Link href="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
              {canManage && <Link href="/settings/downloads#offline-mode" className="text-primary hover:underline">Offline mode settings</Link>}
            </div>
          </div>
        </div>
      ) : children}
    </>
  )
}

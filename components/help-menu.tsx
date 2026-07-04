'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HelpCircle, Compass, LifeBuoy, Keyboard, MessageSquarePlus } from 'lucide-react'
import { getTour } from '@/lib/tours'

// One Help menu to keep the top bar to consistent icons. Consolidates the page
// tour, the Guide, keyboard shortcuts, and feedback — the standard SaaS pattern,
// instead of scattering text buttons across the bar.
export function HelpMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const hasTour = !!getTour(pathname)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none"
        title="Help"
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {hasTour && (
          <DropdownMenuItem onClick={() => window.dispatchEvent(new Event('orbit:run-tour'))} className="gap-2">
            <Compass className="h-3.5 w-3.5" />
            Take a tour of this page
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push('/guide')} className="gap-2">
          <LifeBuoy className="h-3.5 w-3.5" />
          Help Guide
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))} className="gap-2">
          <Keyboard className="h-3.5 w-3.5" />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.dispatchEvent(new Event('orbit:open-feedback'))} className="gap-2">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Send feedback
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

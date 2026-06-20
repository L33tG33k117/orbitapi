'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Quick navigation: press `g` then a letter (Gmail/Linear-style). `?` lists them.
// Cmd/Ctrl+K still opens search; these are for fast keyboard jumps.
const ROUTES: Record<string, { path: string; label: string }> = {
  d: { path: '/dashboard', label: 'Overview' },
  a: { path: '/chat', label: 'Assistant' },
  c: { path: '/connectors', label: 'Connectors' },
  s: { path: '/skills', label: 'Skills' },
  p: { path: '/playbooks', label: 'Playbooks' },
  b: { path: '/bundles', label: 'Bundles' },
  v: { path: '/approvals', label: 'Approvals' },
  u: { path: '/usage', label: 'Usage' },
  r: { path: '/reference', label: 'Connector Actions' },
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export function NavHotkeys() {
  const router = useRouter()
  useEffect(() => {
    let pendingG = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return

      if (e.key === '?') {
        e.preventDefault()
        toast('Press g then: ' + Object.entries(ROUTES).map(([k, v]) => `${k} ${v.label}`).join(' · '), { duration: 6000 })
        return
      }

      if (pendingG) {
        pendingG = false
        if (timer) clearTimeout(timer)
        const dest = ROUTES[e.key.toLowerCase()]
        if (dest) { e.preventDefault(); router.push(dest.path) }
        return
      }

      if (e.key.toLowerCase() === 'g') {
        pendingG = true
        timer = setTimeout(() => { pendingG = false }, 1200)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer) }
  }, [router])

  return null
}

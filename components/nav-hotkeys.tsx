'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, X } from 'lucide-react'

// Quick navigation: press `g` then a letter (Gmail/Linear-style). `?` opens a
// panel listing every shortcut. Cmd/Ctrl+K still opens search.
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

function Row({ keys, label }: { keys: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <span className="flex items-center gap-1 shrink-0">{keys}</span>
    </div>
  )
}

export function NavHotkeys() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let pendingG = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return

      if (e.key === '?') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }

      if (pendingG) {
        pendingG = false
        if (timer) clearTimeout(timer)
        const dest = ROUTES[e.key.toLowerCase()]
        if (dest) { e.preventDefault(); setOpen(false); router.push(dest.path) }
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

  if (!open) return null

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      {/* Floats inset with rounded corners on desktop to match the app shell's
          floating panel (otherwise its square corner pokes past the rounded
          frame and looks cut off). Full-bleed on mobile as before. */}
      <aside className="relative h-full w-[330px] max-w-[85vw] overflow-hidden bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 lg:my-2 lg:mr-2 lg:h-[calc(100%-1rem)] lg:rounded-2xl lg:border">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Go to <span className="normal-case font-normal">— press <Kbd>g</Kbd> then the key</span>
            </p>
            <div className="divide-y divide-border/60">
              {Object.entries(ROUTES).map(([k, v]) => (
                <Row key={k} label={v.label} keys={<><Kbd>g</Kbd><span className="text-muted-foreground text-xs">then</span><Kbd>{k}</Kbd></>} />
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">General</p>
            <div className="divide-y divide-border/60">
              <Row label="Search" keys={<><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></>} />
              <Row label="Show this menu" keys={<Kbd>?</Kbd>} />
              <Row label="Close" keys={<Kbd>Esc</Kbd>} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}

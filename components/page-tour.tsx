'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { Compass, X } from 'lucide-react'
import { getTour } from '@/lib/tours'

// Page-aware interactive tour. Lives in the TopBar: shows a "Show me around"
// button on any page that has a tour, runs a Driver.js spotlight walkthrough,
// and offers the tour once (dismissible) on a user's first visit to each page.

export function PageTour() {
  const pathname = usePathname()
  const tour = getTour(pathname)
  const [mounted, setMounted] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const runningRef = useRef(false)

  const offeredKey = tour ? `orbit:tour-offered:${tour.key}` : ''

  useEffect(() => {
    setMounted(true)
  }, [])

  // First-run: auto-offer the tour once per page, then never again.
  useEffect(() => {
    if (!tour) { setShowNudge(false); return }
    let offered = false
    try { offered = localStorage.getItem(offeredKey) === '1' } catch { /* ignore */ }
    if (offered) { setShowNudge(false); return }
    const t = setTimeout(() => setShowNudge(true), 900)
    return () => clearTimeout(t)
  }, [tour, offeredKey])

  function markOffered() {
    try { localStorage.setItem(offeredKey, '1') } catch { /* ignore */ }
    setShowNudge(false)
  }

  function runTour() {
    if (!tour || runningRef.current) return
    runningRef.current = true
    markOffered()
    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: 'rgba(0,0,0,0.6)',
      popoverClass: 'orbit-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: tour.steps,
      onDestroyed: () => { runningRef.current = false },
    })
    d.drive()
  }

  if (!mounted || !tour) return null

  return (
    <>
      {/* Theme-matched Driver.js popovers (defaults are light) */}
      <style>{`
        .driver-popover.orbit-tour {
          background: var(--popover); color: var(--popover-foreground);
          border: 1px solid var(--border); border-radius: 14px;
          box-shadow: 0 18px 50px -12px rgba(0,0,0,0.55);
          max-width: 320px;
        }
        .driver-popover.orbit-tour .driver-popover-title { color: var(--foreground); font-weight: 600; font-size: 15px; }
        .driver-popover.orbit-tour .driver-popover-description { color: var(--muted-foreground); font-size: 13px; line-height: 1.5; }
        .driver-popover.orbit-tour .driver-popover-progress-text { color: var(--muted-foreground); font-size: 11px; }
        .driver-popover.orbit-tour .driver-popover-footer button {
          background: var(--muted); color: var(--foreground); text-shadow: none;
          border-radius: 8px; border: 1px solid var(--border); font-size: 12px; padding: 5px 10px;
        }
        .driver-popover.orbit-tour .driver-popover-footer button:hover { filter: brightness(1.15); }
        .driver-popover.orbit-tour .driver-popover-next-btn {
          background: var(--primary) !important; color: var(--primary-foreground) !important; border-color: transparent !important;
        }
        .driver-popover.orbit-tour .driver-popover-close-btn { color: var(--muted-foreground); }
        .driver-popover.orbit-tour .driver-popover-arrow { border-color: var(--popover); }
      `}</style>

      <button
        onClick={runTour}
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Take a guided tour of this page"
      >
        <Compass className="h-3.5 w-3.5" />
        Show me around
      </button>

      {/* First-visit nudge */}
      {showNudge && (
        <div className="fixed right-4 top-16 z-[60] w-72 rounded-xl border border-primary/30 bg-popover shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={markOffered}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-0.5"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <Compass className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">New to this page?</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Take a 30-second guided tour — I&apos;ll point out what each part does.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={runTour}
              className="flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-1.5 hover:opacity-90 transition-opacity"
            >
              Start tour
            </button>
            <button
              onClick={markOffered}
              className="rounded-lg border border-border text-xs font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  )
}

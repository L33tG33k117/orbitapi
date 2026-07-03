'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Orbit } from 'lucide-react'

// The Overview "mission control" visual: the workspace as a glowing core with
// each connected API rendered as a satellite on a slowly spinning orbit ring.
// Pure CSS animation (no canvas) — rings spin via .orbit-ring-spin and each
// satellite counter-spins so its logo stays upright. Hovering the system pauses
// every orbit so a moving satellite is easy to click. Each satellite is a link
// into that connector's page. Reduced-motion users get a static orbital map.
//
// Satellites are placed with three nested transforms:
//   1. placement — rotate(angle) translateX(radius) puts the chip on the ring
//   2. static counter-rotate(-angle) undoes the placement rotation
//   3. animated counter-spin undoes the ring's spin
// so the chip content is always upright while it travels the orbit.

interface OrbitConnection {
  id: string
  label: string
  status: string
  slug?: string | null
}

const SIZE = 320
const CENTER = SIZE / 2
// radius, spin duration (inner orbits faster), angle offset (staggers rings)
const RINGS: [number, number, number][] = [
  [66, 45, 0],
  [102, 70, 26],
  [138, 95, 58],
]
// max satellites per ring, inner → outer
const RING_CAPACITY = [3, 4, 5]

function statusDot(status: string) {
  if (/error|fail|expired|invalid|revoked/i.test(status)) return 'bg-red-400'
  if (/pending|setup|paused/i.test(status)) return 'bg-amber-400'
  return 'bg-emerald-400'
}

// The chip: the connector's real logo (so you can tell at a glance which app it
// is), falling back to the first letter if the logo is missing.
function Satellite({ c }: { c: OrbitConnection }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <Link
      href={`/connectors/${c.id}`}
      title={`${c.label} — ${c.status} · open`}
      aria-label={`Open ${c.label}`}
      className="group/sat relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] backdrop-blur-sm text-[11px] font-bold text-white/90 shadow-[0_0_14px_-2px_oklch(0.6_0.2_280/50%)] transition-transform hover:scale-125 hover:border-white/40 hover:z-10"
    >
      {c.slug && imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/logos/${c.slug}.svg`}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        c.label.charAt(0).toUpperCase() || '?'
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[oklch(0.13_0.026_276)] ${statusDot(c.status)}`} />
    </Link>
  )
}

export function OrbitVisual({ connections }: { connections: OrbitConnection[] }) {
  // Split connections across rings by capacity; anything beyond the total
  // capacity collapses into a "+N" satellite on the outer ring — so 100 apps
  // stays the same size, it doesn't grow the visual.
  const totalCapacity = RING_CAPACITY.reduce((a, b) => a + b, 0)
  const shown = connections.slice(0, totalCapacity)
  const overflow = connections.length - shown.length
  const ringMembers: OrbitConnection[][] = []
  let cursor = 0
  for (const cap of RING_CAPACITY) {
    ringMembers.push(shown.slice(cursor, cursor + cap))
    cursor += cap
  }

  return (
    <div className="orbit-system relative shrink-0 max-sm:scale-[0.78]" style={{ width: SIZE, height: SIZE }}>
      {/* Orbit paths */}
      {RINGS.map(([r], i) => (
        <div
          key={r}
          aria-hidden
          className={`absolute rounded-full border ${connections.length === 0 && i === 1 ? 'border-dashed border-white/20' : 'border-white/10'}`}
          style={{ inset: CENTER - r }}
        />
      ))}

      {/* Satellites */}
      {RINGS.map(([r, duration, offset], ringIdx) => {
        const members = ringMembers[ringIdx]
        const isOuter = ringIdx === RINGS.length - 1
        const slots = isOuter && overflow > 0 ? members.length + 1 : members.length
        if (slots === 0) return null
        return (
          <div
            key={`ring-${ringIdx}`}
            className="orbit-ring-spin absolute inset-0"
            style={{ '--orbit-duration': `${duration}s` } as React.CSSProperties}
          >
            {members.map((c, i) => {
              const angle = offset + (i / slots) * 360
              return (
                <div
                  key={c.id}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `rotate(${angle}deg) translateX(${r}px)` }}
                >
                  <div style={{ transform: `rotate(${-angle}deg)` }}>
                    <div className="orbit-counter-spin -translate-x-1/2 -translate-y-1/2" style={{ '--orbit-duration': `${duration}s` } as React.CSSProperties}>
                      <Satellite c={c} />
                    </div>
                  </div>
                </div>
              )
            })}
            {isOuter && overflow > 0 && (
              <div
                className="absolute left-1/2 top-1/2"
                style={{ transform: `rotate(${offset + ((slots - 1) / slots) * 360}deg) translateX(${r}px)` }}
              >
                <div style={{ transform: `rotate(${-(offset + ((slots - 1) / slots) * 360)}deg)` }}>
                  <div className="orbit-counter-spin -translate-x-1/2 -translate-y-1/2" style={{ '--orbit-duration': `${duration}s` } as React.CSSProperties}>
                    <Link
                      href="/connectors"
                      title={`${overflow} more — see all connectors`}
                      aria-label={`${overflow} more connectors`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] backdrop-blur-sm text-[10px] font-bold text-white/70 transition-transform hover:scale-125 hover:text-white hover:border-white/40"
                    >
                      +{overflow}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Workspace core */}
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-glow-pulse flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)]">
          <Orbit className="h-7 w-7 text-white" />
        </div>
      </div>
    </div>
  )
}

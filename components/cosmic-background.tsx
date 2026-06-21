'use client'

import { useEffect, useRef } from 'react'

// A living starfield that orbits as you scroll. Stars are placed in polar
// coordinates around a center point; scrolling rotates the whole field (deeper
// stars rotate more, creating parallax), so the page feels like it's turning
// through space. A faint Milky Way band and a couple of nebula clouds drift
// along for depth. Everything is drawn on one canvas with requestAnimationFrame
// and a smoothed (lerped) scroll value so the motion stays buttery.
//
// Respects prefers-reduced-motion: renders a single static frame instead.

interface Star {
  a0: number      // base angle (radians)
  r: number       // radius from center (fraction of maxRadius)
  size: number
  depth: number   // 0 = far/slow, 1 = near/fast (parallax + rotation amount)
  tw: number      // twinkle speed
  phase: number   // twinkle phase
  tint: string    // rgb tint
}

const STAR_TINTS = [
  '255,255,255',
  '255,255,255',
  '214,224,255', // cool white-blue
  '226,214,255', // faint violet
  '255,236,214', // warm
]

export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let maxRadius = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: Star[] = []

    function buildStars() {
      // Density scales with screen area; capped for performance.
      const count = Math.min(460, Math.floor((width * height) / 5200))
      stars = Array.from({ length: count }, () => {
        // sqrt distribution keeps areal density even out to the corners.
        const r = Math.sqrt(Math.random()) * 1.05
        return {
          a0: Math.random() * Math.PI * 2,
          r,
          size: Math.random() * 1.4 + 0.4,
          depth: Math.pow(Math.random(), 1.5),
          tw: Math.random() * 1.8 + 0.4,
          phase: Math.random() * Math.PI * 2,
          tint: STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0],
        }
      })
    }

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      maxRadius = Math.hypot(width, height) / 2 * 1.1
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildStars()
    }

    let smoothRot = 0
    let rafId = 0

    function targetRotation() {
      // Tie rotation to how far the page is scrolled.
      return window.scrollY * 0.00055
    }

    function drawNebula(cx: number, cy: number, rot: number, t: number) {
      const blobs = [
        { ang: rot * 0.4 + 0.6, dist: maxRadius * 0.35, rad: maxRadius * 0.55, color: '120, 90, 240', alpha: 0.10 },
        { ang: rot * 0.4 + 3.4, dist: maxRadius * 0.45, rad: maxRadius * 0.5, color: '60, 120, 230', alpha: 0.08 },
        { ang: rot * 0.4 + 5.0 + Math.sin(t * 0.0001) * 0.3, dist: maxRadius * 0.3, rad: maxRadius * 0.4, color: '200, 90, 220', alpha: 0.06 },
      ]
      for (const b of blobs) {
        const x = cx + Math.cos(b.ang) * b.dist
        const y = cy + Math.sin(b.ang) * b.dist
        const g = ctx!.createRadialGradient(x, y, 0, x, y, b.rad)
        g.addColorStop(0, `rgba(${b.color}, ${b.alpha})`)
        g.addColorStop(1, `rgba(${b.color}, 0)`)
        ctx!.fillStyle = g
        ctx!.fillRect(0, 0, width, height)
      }
    }

    function drawMilkyWay(cx: number, cy: number, rot: number) {
      ctx!.save()
      ctx!.translate(cx, cy)
      ctx!.rotate(rot * 0.35 + 0.5)
      const bandLen = maxRadius * 2.2
      const bandWid = maxRadius * 0.42
      const g = ctx!.createLinearGradient(0, -bandWid / 2, 0, bandWid / 2)
      g.addColorStop(0, 'rgba(150, 160, 230, 0)')
      g.addColorStop(0.5, 'rgba(170, 175, 235, 0.07)')
      g.addColorStop(1, 'rgba(150, 160, 230, 0)')
      ctx!.fillStyle = g
      ctx!.fillRect(-bandLen / 2, -bandWid / 2, bandLen, bandWid)
      ctx!.restore()
    }

    function render(t: number) {
      const target = targetRotation()
      // Lerp toward the scroll-driven target + a slow idle drift so it breathes.
      smoothRot += (target - smoothRot) * 0.06
      const rot = smoothRot + t * 0.00002

      const cx = width * 0.5
      const cy = height * 0.42

      ctx!.clearRect(0, 0, width, height)

      drawNebula(cx, cy, rot, t)
      drawMilkyWay(cx, cy, rot)

      for (const s of stars) {
        const ang = s.a0 + rot * (0.35 + s.depth * 1.3)
        const radius = s.r * maxRadius
        const x = cx + Math.cos(ang) * radius
        const y = cy + Math.sin(ang) * radius
        if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue
        const twinkle = reduceMotion ? 0.85 : 0.65 + 0.35 * Math.sin(t * 0.001 * s.tw + s.phase)
        const alpha = (0.25 + s.depth * 0.75) * twinkle
        ctx!.beginPath()
        ctx!.arc(x, y, s.size, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${s.tint}, ${alpha})`
        ctx!.fill()
      }

      if (!reduceMotion) rafId = requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize)
    if (reduceMotion) {
      smoothRot = targetRotation()
      render(0)
    } else {
      rafId = requestAnimationFrame(render)
    }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // z-0 sits above the page's opaque background but below the content
      // sections (which are position:relative and paint after it in tree order).
      className="fixed inset-0 pointer-events-none z-0"
    />
  )
}

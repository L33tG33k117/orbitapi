'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

// Fades + slides its children in the first time they scroll into view, using an
// IntersectionObserver. Pairs with the .reveal / .is-visible utilities in
// globals.css. `delay` (ms) lets you stagger a row of cards. Honors
// prefers-reduced-motion automatically (the CSS shows content immediately).

interface RevealProps {
  children: ReactNode
  as?: ElementType
  className?: string
  delay?: number
  /** how far into the viewport before triggering (0–1) */
  threshold?: number
}

export function Reveal({ children, as, className = '', delay = 0, threshold = 0.15 }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect() // reveal once, then stop watching
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

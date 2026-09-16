'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'

// Top-bar entry point for release notes.
//
// Admins go to the full technical feed, everyone else to the customer notes.
// The dot marks "something shipped since you last looked" — per-browser, from
// localStorage, which is a convenience rather than a record: it can come back
// empty in a private window or with site data blocked, and when it does the
// button simply shows no dot. Every read and write is guarded for that reason.
const SEEN_KEY = 'orbit_whats_new_seen'

export function WhatsNewButton({ admin = false, newestDate }: { admin?: boolean; newestDate: string | null }) {
  const [unseen, setUnseen] = useState(false)

  useEffect(() => {
    if (!newestDate) return
    try {
      const seen = window.localStorage.getItem(SEEN_KEY)
      setUnseen(!seen || seen < newestDate)
    } catch {
      setUnseen(false)
    }
  }, [newestDate])

  const href = admin ? '/admin/releases' : '/whats-new'
  const label = admin ? 'Releases' : "What's new"

  return (
    <Link
      href={href}
      aria-label={unseen ? `${label} (new since your last visit)` : label}
      title={label}
      className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      <Megaphone className="h-4 w-4" />
      {unseen && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
        />
      )}
    </Link>
  )
}

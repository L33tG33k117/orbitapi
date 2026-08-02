'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, X, BookOpen, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// A dismissible "why use this & how it fits" card shown at the top of each major
// section. The goal is to teach the mental model — how the pieces build on each
// other — without forcing anyone into docs. Copy lives in one registry so it
// stays consistent and easy to edit.

interface IntroContent {
  title: string
  what: string        // one-line "what is this"
  fits: string        // "how it fits with the rest" — the mental-model bit
  // Optional video/GIF embed. Drop a URL here later (mp4, gif, or an embeddable
  // iframe src) and the player appears automatically — no other code changes.
  video?: { src: string; type?: 'mp4' | 'iframe' | 'gif' }
}

export const SECTION_INTROS = {
  connectors: {
    title: 'What are connectors?',
    what: 'A connector is a ready-made link to an app’s API (Slack, NetSuite, CrowdStrike…). Connect a real one with your keys, or hit “Simulate” to try it with realistic fake data.',
    fits: 'Connectors are the foundation — the Orbit Assistant, Skills, and Playbooks all act through them. Start here, then everything else has something to do.',
  },
  groups: {
    title: 'What are groups?',
    what: 'A group bundles related connections together (e.g. a “Finance” group with NetSuite + Slack).',
    fits: 'Groups scope what a Skill or the Assistant is allowed to touch. Optional — but they keep an agent focused on just the right apps.',
  },
  skills: {
    title: 'What are skills?',
    what: 'A Skill is a reusable AI agent with a persona and a job — “check for large invoices and alert me”.',
    fits: 'Skills act through your Connectors (optionally narrowed by a Group). Run them by hand, on a schedule, or fully autonomously. Most useful chats can be saved as a Skill.',
  },
  playbooks: {
    title: 'What are playbooks?',
    what: 'A Playbook is a multi-step, branching workflow with approval chains.',
    fits: 'Where a Skill is one agent doing a job, a Playbook orchestrates several steps and actions across connectors — ideal for incident response and ops runbooks.',
  },
  bundles: {
    title: 'What are bundles?',
    what: 'A Bundle is a ready-made pack of connectors, skills, and mappings for a use case.',
    fits: 'Install a bundle to get a working setup in one click instead of building each piece yourself — a fast path once you know what you want.',
  },
  'data-mapping': {
    title: 'What is data mapping?',
    what: 'Data mapping translates fields from one connector into another — e.g. a Zendesk ticket → a ServiceNow incident.',
    fits: 'It’s the glue for cross-app workflows: Orbit proposes the field mappings, previews against a live sample, and you approve before automating.',
  },
  webhooks: {
    title: 'What are webhooks?',
    what: 'A webhook is a private URL that Orbit gives you. When something happens in another app — a payment lands, an order comes in — that app calls the URL to tell Orbit about it.',
    fits: 'It’s the difference between Orbit checking every hour and the other app tapping Orbit on the shoulder the second it happens. Paste the URL into the other app once; Orbit runs your Skill or Playbook every time it’s called.',
  },
  approvals: {
    title: 'What are approvals?',
    what: 'Approvals are the safety gate for risky actions queued by your skills.',
    fits: 'When a skill wants to write or delete something, it pauses here for your sign-off — so automation never acts without oversight on the actions that matter.',
  },
} satisfies Record<string, IntroContent>

export type SectionIntroId = keyof typeof SECTION_INTROS

function VideoSlot({ video, title }: { video: NonNullable<IntroContent['video']>; title: string }) {
  if (video.type === 'iframe') {
    return (
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/40">
        <iframe src={video.src} title={title} className="h-full w-full" allowFullScreen />
      </div>
    )
  }
  if (video.type === 'gif') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={video.src} alt={title} className="mt-3 w-full rounded-lg border border-border" />
  }
  return (
    <video src={video.src} controls className="mt-3 w-full rounded-lg border border-border bg-black/40" />
  )
}

export function SectionIntro({ id, className }: { id: SectionIntroId; className?: string }) {
  const content: IntroContent = SECTION_INTROS[id]
  const storageKey = `orbit:section-intro:${id}`

  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try { setDismissed(localStorage.getItem(storageKey) === '1') } catch { /* ignore */ }
  }, [storageKey])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
  }

  // Render nothing until mounted (localStorage is client-only) or once dismissed.
  if (!mounted || dismissed) return null

  return (
    <div className={cn('rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3', className)}>
      <div className="flex items-start gap-2">
        <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition-colors"
          >
            {content.title}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
          </button>

          {!collapsed && (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-xs text-muted-foreground leading-relaxed">{content.what}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/70">How it fits: </span>{content.fits}
              </p>
              {content.video && <VideoSlot video={content.video} title={content.title} />}
              <Link
                href="/guide"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-0.5"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                See how it all fits together
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

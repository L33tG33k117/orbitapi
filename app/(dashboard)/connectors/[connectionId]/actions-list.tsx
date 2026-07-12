'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Globe, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Risk = 'read' | 'write' | 'destructive'
type Policy = 'auto' | 'approve' | 'never'
interface ActionItem { slug: string; name: string; risk: string }

const POLICY_OPTIONS: { value: Policy | ''; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'auto', label: 'Automatic' },
  { value: 'approve', label: 'Manual approve' },
  { value: 'never', label: 'Never' },
]

const FILTERS: { key: 'all' | Risk; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'read', label: 'Read' },
  { key: 'write', label: 'Write' },
  { key: 'destructive', label: 'Destructive' },
]

const VERB_PREFIXES = [
  'list', 'get', 'search', 'create', 'update', 'delete', 'send', 'add', 'remove',
  'cancel', 'block', 'run', 'set', 'toggle', 'apply', 'assign', 'change', 'close',
  'open', 'start', 'stop', 'trigger', 'acknowledge', 'resolve', 'mark', 'merge',
  'suspend', 'schedule', 'record', 'validate', 'check', 'fetch', 'collect',
  'isolate', 'release', 'contain', 'lift', 'hide', 'snooze', 'reboot', 'enable',
  'disable', 'invite', 'kick', 'archive', 'authorize', 'decommission', 'initiate',
  'abort', 'mitigate', 'reconnect', 'rejoin', 'scan', 'make', 'lookup', 'post', 'reply',
]

// "list_guest_messages" → "Guest messages"; "get_booking" / "list_bookings" both → "Bookings".
// Grouping by the thing acted on turns a 40-row flat list into a handful of scannable topics.
function topicOf(slug: string): string {
  const words = slug.split(/[_-]/).filter(Boolean)
  const noun = (words.length > 1 && VERB_PREFIXES.includes(words[0]) ? words.slice(1) : words)
    .join(' ')
    .trim() || slug
  // Normalize singular/plural so get_booking and list_bookings share a group key.
  const key = noun.endsWith('ies') ? noun.slice(0, -3) + 'y' : noun.endsWith('s') ? noun.slice(0, -1) : noun
  return key
}

function displayTopic(key: string): string {
  const label = key.endsWith('y') ? key.slice(0, -1) + 'ies' : key + 's'
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function ActionRow({ a, policy, onPolicy }: {
  a: ActionItem
  policy?: Policy | ''
  onPolicy?: (slug: string, policy: Policy | '') => void
}) {
  const disabled = policy === 'never'
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <Badge
        variant={a.risk === 'read' ? 'outline' : a.risk === 'write' ? 'secondary' : 'destructive'}
        className="text-xs shrink-0 w-20 justify-center"
      >
        {a.risk}
      </Badge>
      <p className={`text-sm font-medium flex-1 min-w-0 truncate ${disabled ? 'text-muted-foreground line-through' : ''}`}>{a.name}</p>
      <p className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:block">{a.slug}</p>
      {onPolicy && (
        <select
          value={policy ?? ''}
          onChange={e => onPolicy(a.slug, e.target.value as Policy | '')}
          aria-label={`Permission for ${a.name}`}
          className={`h-7 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
            policy === 'never' ? 'text-destructive border-destructive/40' : policy ? 'text-primary border-primary/40' : 'text-muted-foreground'
          }`}
        >
          {POLICY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  )
}

export function ActionsList({ actions, connectorName, connectorSlug, connectionId, canManage, initialPolicies }: {
  actions: ActionItem[]
  connectorName?: string
  connectorSlug?: string
  connectionId?: string
  canManage?: boolean
  initialPolicies?: Record<string, string> | null
}) {
  const [filter, setFilter] = useState<'all' | Risk>('all')
  const [query, setQuery] = useState('')
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({})
  const [policies, setPolicies] = useState<Record<string, Policy | ''>>(
    () => Object.fromEntries(Object.entries(initialPolicies ?? {})
      .filter(([, v]) => v === 'auto' || v === 'approve' || v === 'never')) as Record<string, Policy>,
  )

  const managing = !!canManage && !!connectionId

  async function setPolicy(slug: string, policy: Policy | '') {
    const prev = policies[slug] ?? ''
    setPolicies(p => ({ ...p, [slug]: policy }))
    const res = await fetch(`/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionPolicy: { slug, policy: policy || null } }),
    })
    if (!res.ok) {
      setPolicies(p => ({ ...p, [slug]: prev }))
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? 'Could not save the permission')
      return
    }
    const label = POLICY_OPTIONS.find(o => o.value === policy)?.label ?? 'Default'
    toast.success(`“${actions.find(a => a.slug === slug)?.name ?? slug}” set to ${label}`)
  }

  // The universal "reach any endpoint" action is showcased separately as the
  // headline capability, not buried as one row among the curated shortcuts.
  const hasExplore = actions.some(a => a.slug === 'explore_api')
  const curated = actions.filter(a => a.slug !== 'explore_api')

  const counts = useMemo(() => ({
    all: curated.length,
    read: curated.filter(a => a.risk === 'read').length,
    write: curated.filter(a => a.risk === 'write').length,
    destructive: curated.filter(a => a.risk === 'destructive').length,
  }), [curated])

  const q = query.trim().toLowerCase()
  const visible = curated.filter(a =>
    (filter === 'all' || a.risk === filter) &&
    (!q || a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)),
  )

  const groups = useMemo(() => {
    const map = new Map<string, ActionItem[]>()
    for (const a of visible) {
      const t = topicOf(a.slug)
      map.set(t, [...(map.get(t) ?? []), a])
    }
    return [...map.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]))
  }, [visible])

  // Short lists don't need the accordion; grouping earns its keep on big connectors.
  const grouped = curated.length > 12 && !q

  return (
    <div className="space-y-3">
      {hasExplore && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4 space-y-1.5">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Full API access — not just the {counts.all} shortcuts below
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The shortcuts are the common tasks made one-click. But {connectorName ?? 'this app'}&apos;s API can do
            far more, and OrbitAPI can reach <span className="text-foreground font-medium">any of it</span> — just ask in plain
            English. This is where OrbitAPI shines: an app&apos;s screens often cap what you see (last 90 days, first 100 rows),
            while the API holds the full history. Ask for it and OrbitAPI pulls it.
          </p>
          <Link href="/chat" className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-0.5">
            <Sparkles className="h-3 w-3" /> Try: &ldquo;pull every record since the beginning, not just recent ones&rdquo; →
          </Link>
        </div>
      )}
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search actions by name or slug…"
        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {managing && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each action has a permission on this connection: <span className="text-foreground font-medium">Automatic</span> runs
          with no approval step, <span className="text-foreground font-medium">Manual approve</span> queues every automated use
          (assistant, skills, playbooks, external AI) for a human to approve, and <span className="text-foreground font-medium">Never</span> disables
          the action entirely. <span className="text-foreground font-medium">Default</span> keeps the standard behavior — reads run
          instantly, writes ask first where the product normally asks.
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {grouped ? (
        <div className="border rounded-lg divide-y">
          {groups.map(([topic, items]) => {
            const open = openTopics[topic] ?? false
            return (
              <div key={topic}>
                <button
                  onClick={() => setOpenTopics(o => ({ ...o, [topic]: !open }))}
                  className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-muted/40 transition-colors"
                >
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className="text-sm font-medium flex-1">{displayTopic(topic)}</span>
                  <span className="text-xs text-muted-foreground">{items.length} action{items.length !== 1 ? 's' : ''}</span>
                </button>
                {open && <div className="divide-y border-t bg-muted/20">{items.map(a => <ActionRow key={a.slug} a={a} policy={policies[a.slug] ?? ''} onPolicy={managing ? setPolicy : undefined} />)}</div>}
              </div>
            )
          })}
          {groups.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No {filter === 'all' ? '' : filter + ' '}actions.</p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {visible.map(a => <ActionRow key={a.slug} a={a} policy={policies[a.slug] ?? ''} onPolicy={managing ? setPolicy : undefined} />)}
          {visible.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {q ? `No actions match “${query.trim()}”.` : `No ${filter} actions.`}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Want one of these promoted to a one-click shortcut, or don&apos;t see what you need?{' '}
        <Link href={`/connectors/requests?connector=${connectorSlug ?? ''}`} className="text-primary hover:underline">
          Request an action
        </Link>{' '}
        — meanwhile, just ask for it in the assistant.
      </p>
    </div>
  )
}

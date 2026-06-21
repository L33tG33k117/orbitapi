'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquarePlus, Trash2, Clock, ChevronLeft, Save, Plug, ArrowRight } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { AiPowerMeter, type AiPowerState } from '@/components/ai-power-meter'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelFromToolName(name: string): string {
  const slug = name.split('__').pop() ?? name
  return slug.replace(/_/g, ' ')
}

// Turn a conversation into a reusable skill persona (the user's instructions
// become the workflow). The user refines name/persona in the editor afterward.
function buildSkillFromMessages(messages: UIMessage[]): { name: string; persona: string } {
  const userTexts = messages
    .filter(m => m.role === 'user')
    .map(m => m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join(' ').trim())
    .filter(Boolean)
  const first = userTexts[0] ?? 'My skill'
  const name = first.length > 48 ? `${first.slice(0, 48)}…` : first
  const steps = userTexts.map(t => `- ${t}`).join('\n')
  const persona = `You are a reusable skill created from an Orbit Assistant chat.\n\nWhen run, carry out this workflow:\n${steps || '- (describe the task here)'}\n\nAlways check current data before acting, and confirm before any risky or destructive write.`
  return { name, persona }
}

function generateId(): string {
  return crypto.randomUUID()
}

// The chat API returns structured errors (e.g. 402 OUT_OF_AI_POWER with a
// user-friendly `message`). Surface that instead of a generic failure so users
// know what happened and what to do.
function parseChatError(error: Error | undefined): { message: string; outOfPower: boolean } {
  if (!error) return { message: '', outOfPower: false }
  let message = 'Something went wrong. Please try again.'
  let outOfPower = false
  try {
    const body = JSON.parse(error.message)
    if (body?.error === 'OUT_OF_AI_POWER') outOfPower = true
    if (typeof body?.message === 'string') message = body.message
    else if (typeof body?.error === 'string' && body.error !== 'OUT_OF_AI_POWER') message = body.error
  } catch { /* not JSON */ }
  if (/out of ai power/i.test(error.message)) { outOfPower = true; if (message === 'Something went wrong. Please try again.') message = error.message }
  return { message, outOfPower }
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingOutput {
  __orbit_pending: true
  pending_action_id: string
  action_name: string
  connection_name: string
  params: Record<string, unknown>
  summary: string
}

function isPendingOutput(v: unknown): v is PendingOutput {
  return typeof v === 'object' && v !== null && '__orbit_pending' in v && (v as PendingOutput).__orbit_pending === true
}

interface ConversationMeta {
  id: string
  title: string | null
  updated_at: string
}

interface Skill {
  id: string
  name: string
  description: string | null
  autonomy: string
  group: { name: string; color: string } | null
}

// ─── ConfirmationCard ─────────────────────────────────────────────────────────

function ConfirmationCard({ out }: { out: PendingOutput }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'rejected' | 'error'>('idle')
  const [resultMsg, setResultMsg] = useState('')

  async function confirm() {
    setState('loading')
    try {
      const res = await fetch(`/api/pending-actions/${out.pending_action_id}/confirm`, { method: 'POST' })
      if (res.ok) { setState('done'); setResultMsg('Action executed successfully.') }
      else {
        const body = await res.json().catch(() => ({}))
        setState('error'); setResultMsg(body.error ?? 'Execution failed.')
      }
    } catch { setState('error'); setResultMsg('Network error.') }
  }

  async function reject() {
    setState('loading')
    await fetch(`/api/pending-actions/${out.pending_action_id}/reject`, { method: 'POST' }).catch(() => {})
    setState('rejected')
  }

  const paramEntries = Object.entries(out.params ?? {})

  return (
    <div className="mt-2 rounded-xl border border-border bg-background text-foreground p-4 space-y-3 shadow-sm max-w-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pending action</p>
        <p className="text-sm font-medium">{out.action_name}</p>
        <p className="text-xs text-muted-foreground">{out.connection_name}</p>
      </div>
      {paramEntries.length > 0 && (
        <div className="rounded-md bg-muted px-3 py-2 space-y-0.5">
          {paramEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="text-muted-foreground min-w-[80px] shrink-0">{k}</span>
              <span className="font-mono truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {state === 'idle' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={confirm} className="flex-1">Confirm</Button>
          <Button size="sm" variant="outline" onClick={reject} className="flex-1">Reject</Button>
        </div>
      )}
      {state === 'loading' && <p className="text-xs text-muted-foreground animate-pulse">Processing…</p>}
      {state === 'done' && <p className="text-xs text-green-600 font-medium">✓ {resultMsg}</p>}
      {state === 'rejected' && <p className="text-xs text-muted-foreground">Rejected.</p>}
      {state === 'error' && <p className="text-xs text-destructive">✕ {resultMsg}</p>}
    </div>
  )
}

// ─── ChatCore ─────────────────────────────────────────────────────────────────

function ChatCore({
  skillId,
  suggestions,
  conversationId,
  initialMessages,
}: {
  skillId: string
  suggestions: string[]
  conversationId: string
  initialMessages?: UIMessage[]
}) {
  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      body: { skillId: skillId || undefined, conversationId },
    }),
  })
  const router = useRouter()
  const [input, setInput] = useState('')
  const [savingSkill, setSavingSkill] = useState(false)
  const isLoading = status === 'submitted' || status === 'streaming'
  const bottomRef = useRef<HTMLDivElement>(null)

  async function saveAsSkill() {
    setSavingSkill(true)
    const { name, persona } = buildSkillFromMessages(messages as UIMessage[])
    try {
      const res = await fetch('/api/skills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, persona }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && data.error === 'plan_required') {
        toast.error(data.message ?? 'Upgrade to save more skills.', {
          action: { label: 'Upgrade', onClick: () => router.push('/upgrade') },
        })
        return
      }
      if (!res.ok) { toast.error(data.error ?? 'Could not save skill.'); return }
      toast.success('Skill created — customize it here.')
      router.push(`/skills/${data.id}`)
    } catch {
      toast.error('Could not save skill.')
    } finally {
      setSavingSkill(false)
    }
  }

  // Seed messages from history when this conversation is loaded
  useEffect(() => {
    if (initialMessages) setMessages(initialMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // When a response finishes streaming, the server has consumed AI Power — tell
  // the meter to refresh so it reflects what this message cost.
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status !== 'streaming') {
      window.dispatchEvent(new Event('orbit:power-changed'))
    }
    prevStatus.current = status
  }, [status])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">✦</span>
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">Ask Orbit anything</p>
              <p className="text-sm mt-1">It has access to all your connected APIs.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg w-full">
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  className="text-left text-sm border rounded-xl p-3 hover:bg-muted hover:border-primary/30 transition-all"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {(messages as UIMessage[]).map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm space-y-1 ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  return m.role === 'user'
                    ? <span key={i} className="block" style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
                    : <Markdown key={i} text={part.text} />
                }
                if (part.type === 'dynamic-tool') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const output = (part as any).output
                  const done = part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied'
                  if (part.state === 'output-available' && isPendingOutput(output)) {
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-1.5 text-xs opacity-70 italic mb-1">
                          <span>⏸</span><span>Staged: {output.action_name}</span>
                        </div>
                        <ConfirmationCard out={output} />
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs opacity-70 italic">
                      <span>{done ? '✓' : '⏳'}</span>
                      <span>{done ? `Fetched: ${labelFromToolName(part.toolName)}` : `Checking ${labelFromToolName(part.toolName)}…`}</span>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}

        {isLoading && (messages as UIMessage[]).at(-1)?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">Thinking…</div>
          </div>
        )}
        {error && (() => {
          const { message, outOfPower } = parseChatError(error)
          if (outOfPower) {
            return (
              <div className="mx-auto max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-2">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{message}</p>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" onClick={() => router.push('/upgrade')}>Upgrade plan</Button>
                  <Button size="sm" variant="outline" onClick={() => router.push('/ai-power')}>Get a Power Pack</Button>
                </div>
              </div>
            )
          }
          return <p className="text-sm text-destructive text-center">{message}</p>
        })()}
        <div ref={bottomRef} />
      </div>

      {messages.length >= 2 && !isLoading && (
        <div className="px-4 pt-2 flex justify-end">
          <button
            type="button"
            onClick={saveAsSkill}
            disabled={savingSkill}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            title="Turn this conversation into a reusable, re-runnable skill"
          >
            <Save className="h-3.5 w-3.5" />
            {savingSkill ? 'Saving…' : 'Save as reusable skill'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 bg-background shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your connected APIs…"
          disabled={isLoading}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>Send</Button>
      </form>
    </>
  )
}

// ─── History Sidebar ──────────────────────────────────────────────────────────

function HistorySidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  collapsed,
  onToggle,
}: {
  conversations: ConversationMeta[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  collapsed: boolean
  onToggle: () => void
}) {
  if (collapsed) {
    return (
      <div className="border-r bg-muted/20 flex flex-col items-center py-3 gap-3 w-12 shrink-0">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="Show history"
        >
          <Clock className="h-4 w-4" />
        </button>
        <button
          onClick={onNew}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-r bg-muted/10 flex flex-col w-56 shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="New chat"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Collapse"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">No conversations yet</p>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
              activeId === c.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
            }`}
            onClick={() => onSelect(c.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-tight">
                {c.title ?? 'New conversation'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(c.updated_at)}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(c.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0 mt-0.5"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ChatUI (root) ────────────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  'What bookings do I have this week?',
  'List my recent CrowdStrike detections',
  'Show open invoices in NetSuite over $10k',
  'Send me a test SMS via Twilio',
]

// Shown when the workspace has no connections — the data prompts above would
// just confuse a brand-new user (and the assistant can't fulfil them).
const ONBOARDING_SUGGESTIONS = [
  'How do I connect my first app?',
  'What can OrbitAPI do for me?',
  'Can I try a connector without API keys?',
]

export function ChatUI({ skills = [], hasConnections = true, connectorSuggestions = [], aiPower }: { skills?: Skill[]; hasConnections?: boolean; connectorSuggestions?: string[]; aiPower?: AiPowerState }) {
  const [activeSkillId, setActiveSkillId] = useState<string>('')
  const [skillRunStatus, setSkillRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [skillRunMsg, setSkillRunMsg] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Conversation state
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string>(() => generateId())
  const [loadedMessages, setLoadedMessages] = useState<UIMessage[] | undefined>(undefined)
  const [chatKey, setChatKey] = useState(0) // forces ChatCore remount

  // Start with the history rail collapsed on small screens so chat gets full width.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarCollapsed(true)
  }, [])

  const activeSkill = skills.find(s => s.id === activeSkillId) ?? null
  const suggestions = activeSkill
    ? [`Run your standard workflow`, `What does ${activeSkill.name} see right now?`]
    : hasConnections
      ? (connectorSuggestions.length > 0 ? connectorSuggestions : DEFAULT_SUGGESTIONS)
      : ONBOARDING_SUGGESTIONS

  // Load conversation list on mount
  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/conversations').catch(() => null)
    if (!res?.ok) return
    const data = await res.json().catch(() => [])
    setConversations(data)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Load messages for a specific conversation
  async function loadConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`).catch(() => null)
    if (!res?.ok) { startNewChat(); return }
    const data = await res.json().catch(() => null)
    if (!data) return
    // Convert stored messages to UIMessage format
    const uiMessages: UIMessage[] = (data.messages ?? []).map((m: { id: string; role: string; content: string }) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: 'text' as const, text: m.content }],
    }))
    setActiveConvoId(id)
    setLoadedMessages(uiMessages)
    setChatKey(k => k + 1)
  }

  function startNewChat() {
    const newId = generateId()
    setActiveConvoId(newId)
    setLoadedMessages(undefined)
    setChatKey(k => k + 1)
    // Reload history after a moment so the new convo appears once it gets its first message
    setTimeout(loadConversations, 3000)
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {})
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConvoId === id) startNewChat()
  }

  async function handleSelectConversation(id: string) {
    if (id === activeConvoId) return
    await loadConversation(id)
    await loadConversations()
  }

  async function runActiveSkill() {
    if (!activeSkill) return
    setSkillRunStatus('running'); setSkillRunMsg('')
    const mode = activeSkill.autonomy === 'supervised' ? 'dry_run' : 'live'
    try {
      const res = await fetch(`/api/skills/${activeSkill.id}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (res.ok) {
        setSkillRunStatus('done')
        setSkillRunMsg(mode === 'dry_run' ? 'Dry run complete — check Run history.' : 'Skill executed — check Run history.')
      } else {
        const d = await res.json()
        setSkillRunStatus('error'); setSkillRunMsg(d.error ?? 'Run failed')
      }
    } catch { setSkillRunStatus('error'); setSkillRunMsg('Network error') }
    setTimeout(() => setSkillRunStatus('idle'), 4000)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* History sidebar */}
      <HistorySidebar
        conversations={conversations}
        activeId={activeConvoId}
        onSelect={handleSelectConversation}
        onNew={startNewChat}
        onDelete={deleteConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* AI Power meter — shows remaining power and how much each chat uses */}
        {aiPower && (
          <div className="px-4 py-2 border-b flex items-center justify-end shrink-0 bg-background/60">
            <AiPowerMeter initial={aiPower} />
          </div>
        )}

        {/* No-connections banner — the assistant can't fetch real data yet */}
        {!hasConnections && (
          <a
            href="/connectors"
            className="flex items-center gap-3 px-4 py-2.5 border-b bg-primary/5 hover:bg-primary/10 transition-colors shrink-0"
          >
            <Plug className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">No apps connected yet</p>
              <p className="text-xs text-muted-foreground">The assistant can&apos;t pull real data until you connect (or simulate) an app.</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
              Connect one <ArrowRight className="h-3 w-3" />
            </span>
          </a>
        )}

        {/* Skill context picker */}
        {skills.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3 shrink-0 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Context:</span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => { setActiveSkillId(''); setSkillRunStatus('idle') }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  !activeSkillId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                General
              </button>
              {skills.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setActiveSkillId(s.id); setSkillRunStatus('idle') }}
                  className={`text-xs px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
                    activeSkillId === s.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {s.group && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.group.color }} />}
                  {s.name}
                </button>
              ))}
            </div>
            {activeSkill && (
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {skillRunStatus === 'done' && <span className="text-xs text-green-600">{skillRunMsg}</span>}
                {skillRunStatus === 'error' && <span className="text-xs text-destructive">{skillRunMsg}</span>}
                <button
                  type="button"
                  onClick={runActiveSkill}
                  disabled={skillRunStatus === 'running'}
                  className="text-xs px-3 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {skillRunStatus === 'running' ? 'Running…' : activeSkill.autonomy === 'supervised' ? '▷ Test run' : '▷ Run now'}
                </button>
              </div>
            )}
          </div>
        )}

        <ChatCore
          key={`${activeConvoId}-${chatKey}-${activeSkillId || 'general'}`}
          skillId={activeSkillId}
          suggestions={suggestions}
          conversationId={activeConvoId}
          initialMessages={loadedMessages}
        />
      </div>
    </div>
  )
}

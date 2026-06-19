'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, X, Send, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function getPageContext(pathname: string): { label: string; suggestions: string[] } {
  if (pathname === '/dashboard') return {
    label: 'Overview',
    suggestions: ['What can I do here?', 'How do I connect my first API?', 'What are skills used for?'],
  }
  if (pathname.startsWith('/connectors')) return {
    label: 'Connectors',
    suggestions: ['How do I connect a new API?', 'What connectors are available?', 'Help me set up GitHub'],
  }
  if (pathname.startsWith('/groups')) return {
    label: 'Groups',
    suggestions: ['What is a group?', 'Help me create a group', 'How do I add connections to a group?'],
  }
  if (pathname.startsWith('/skills/new') || pathname === '/skills') return {
    label: 'Skills',
    suggestions: ['What is a skill?', 'Help me design a persona', 'What autonomy mode should I use?', 'Show me skill ideas for my APIs'],
  }
  if (pathname.startsWith('/skills/')) return {
    label: 'Skill detail',
    suggestions: ['How do I run this skill?', 'Explain the autonomy modes', 'How do I schedule this skill?'],
  }
  if (pathname.startsWith('/chat')) return {
    label: 'Orbit Assistant',
    suggestions: ['What can you help with?', 'How do I query my APIs?', 'What APIs are connected?'],
  }
  if (pathname.startsWith('/usage')) return {
    label: 'Usage',
    suggestions: ['How is usage calculated?', 'What counts as an API call?', 'How do I export this data?'],
  }
  if (pathname.startsWith('/audit')) return {
    label: 'Audit Log',
    suggestions: ['What is logged here?', 'How do I filter by action?', 'What do the risk levels mean?'],
  }
  if (pathname.startsWith('/settings/billing')) return {
    label: 'Billing',
    suggestions: ["What's included in the Pro plan?", 'How do I upgrade my plan?', 'What happens when I cancel?'],
  }
  if (pathname.startsWith('/settings/members')) return {
    label: 'Members',
    suggestions: ['How do I invite someone?', 'What can each role do?', 'How do custom roles work?'],
  }
  if (pathname.startsWith('/settings/profile')) return {
    label: 'Profile',
    suggestions: ['How do I change my password?', 'What does the delete preference do?', 'How do I delete my account?'],
  }
  if (pathname.startsWith('/settings/workspace')) return {
    label: 'Workspace Settings',
    suggestions: ['How do I rename my workspace?', 'What does tier affect?', 'How do I delete the workspace?'],
  }
  if (pathname.startsWith('/settings')) return {
    label: 'Settings',
    suggestions: ['What can I configure here?', 'How do I manage my team?', 'How do I upgrade my plan?'],
  }
  if (pathname.startsWith('/approvals')) return {
    label: 'Approvals',
    suggestions: ['What needs approval?', 'How do I approve an action?', 'Can I auto-approve?'],
  }
  return {
    label: 'OrbitAPI',
    suggestions: ['What can OrbitAPI do?', 'Help me get started', 'What makes skills powerful?'],
  }
}

const PAGE_INTROS: Record<string, string> = {
  '/dashboard': "You're on the Overview — your command center. I can help you understand what's connected, what's running, and what to build next.",
  '/connectors': "You're browsing Connectors. I can help you choose the right API, walk you through setup, or explain what each connector can do.",
  '/groups': "Groups bundle your connections so skills know which APIs to use. I can help you design the right group structure.",
  '/skills': "Skills are where the magic happens — AI agents with a role. I can suggest personas, autonomy settings, and use cases for your connected APIs.",
  '/chat': "You're chatting with the Orbit Assistant directly. Ask me anything about your APIs or ask me to take actions.",
  '/usage': "You're viewing Usage analytics. I can explain what any metric means or help you interpret trends.",
  '/audit': "The Audit Log captures everything. Ask me about specific event types, risk levels, or how to filter.",
  '/settings/billing': "You're on the Billing page. I can explain what each plan includes, help you decide which tier fits your needs, or walk you through upgrading, canceling, or managing your subscription.",
  '/settings/members': "You're managing workspace members. I can explain what each role can do, help you think through access control, or walk you through inviting someone.",
  '/settings/profile': "You're on your Profile settings. I can explain the delete preference options, help with password changes, or walk you through what account deletion means.",
  '/settings/workspace': "You're in Workspace settings. I can help with renaming the workspace, explain tier differences, or answer questions about workspace management.",
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const ctx = getPageContext(pathname)
  const pageKey = Object.keys(PAGE_INTROS).find(k => pathname.startsWith(k)) ?? ''
  const intro = PAGE_INTROS[pageKey] ?? `You're using OrbitAPI. I'm here to help you get the most out of it.`

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: intro }])
    }
  }, [open, intro, messages.length])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Reset messages when page changes
  useEffect(() => {
    setMessages([])
  }, [pathname])

  // Don't render on the chat page — the user is already in the full assistant.
  // NOTE: this early return MUST stay below all hooks, otherwise navigating to
  // /chat changes the hook count and React throws "Rendered fewer hooks than expected".
  if (pathname.startsWith('/chat')) return null

  async function send(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { page: pathname, pageLabel: ctx.label },
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Let me look into that…' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg font-medium text-sm transition-all duration-200 print:hidden',
          open
            ? 'bg-muted text-muted-foreground hover:bg-muted/80'
            : 'bg-primary text-primary-foreground hover:opacity-90 hover:scale-105',
        )}
        style={{ boxShadow: open ? undefined : '0 4px 24px rgba(var(--primary-rgb, 99 102 241) / 0.4)' }}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {open ? 'Minimize' : 'Orbit Assistant'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[360px] max-h-[540px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden print:hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Orbit Assistant</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ctx.label}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm',
                )}>
                  {m.role === 'user' ? m.content : <Markdown text={m.content} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2">
                  <span className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {ctx.suggestions.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-1.5">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask anything…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="p-1 rounded-lg text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

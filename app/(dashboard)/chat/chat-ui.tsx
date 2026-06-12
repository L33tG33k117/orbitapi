'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function labelFromToolName(name: string): string {
  const slug = name.split('__').pop() ?? name
  return slug.replace(/_/g, ' ')
}

const SUGGESTIONS = [
  'What bookings do I have this week?',
  'Are any properties available next weekend?',
  'List my simulated lights and their status',
  'Do I have any pending guest messages?',
]

export function ChatUI() {
  const { messages, sendMessage, status, error } = useChat()
  const [input, setInput] = useState('')
  const isLoading = status === 'submitted' || status === 'streaming'
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
            <div className="text-4xl">✦</div>
            <div>
              <p className="font-medium text-foreground text-lg">Ask Orbit Assistant anything</p>
              <p className="text-sm mt-1">It has access to all your connected APIs.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className="text-left text-sm border rounded-lg p-3 hover:bg-muted transition-colors"
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
                  return (
                    <span key={i} className="block" style={{ whiteSpace: 'pre-wrap' }}>
                      {part.text}
                    </span>
                  )
                }
                if (part.type === 'dynamic-tool') {
                  const done = part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied'
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs opacity-70 italic">
                      <span>{done ? '✓' : '⏳'}</span>
                      <span>
                        {done
                          ? `Fetched: ${labelFromToolName(part.toolName)}`
                          : `Checking ${labelFromToolName(part.toolName)}…`}
                      </span>
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
            <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">
            Something went wrong. Please try again.
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 bg-background shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your bookings, lights, availability…"
          disabled={isLoading}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}

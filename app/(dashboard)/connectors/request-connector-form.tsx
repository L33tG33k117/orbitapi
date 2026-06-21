'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, ThumbsUp, CheckCircle, Clock, MessageSquare, Send } from 'lucide-react'

interface CommunityRequest {
  id: string
  connector_name: string
  website_url: string | null
  use_case: string | null
  status: 'pending' | 'approved'
  build_status: 'generating' | 'complete' | 'failed' | null
  vote_count: number
  has_voted: boolean
  is_own: boolean
}

interface Message {
  id: string
  sender_type: 'admin' | 'user'
  content: string
  created_at: string
}

function getStatusDisplay(req: CommunityRequest): { label: string; className: string } {
  if (req.status === 'approved') {
    if (req.build_status === 'complete') {
      return { label: 'Available', className: 'bg-emerald-500/15 text-emerald-400' }
    }
    if (req.build_status === 'generating') {
      return { label: 'Building now…', className: 'bg-blue-500/15 text-blue-400' }
    }
    if (req.build_status === 'failed') {
      return { label: 'Build failed', className: 'bg-destructive/15 text-destructive' }
    }
  }
  return { label: 'Under consideration', className: 'bg-amber-500/15 text-amber-400' }
}

function RequestCard({ req, onVote }: { req: CommunityRequest; onVote: (id: string, newCount: number) => void }) {
  const [voting, setVoting] = useState(false)
  const [voted, setVoted] = useState(req.has_voted)
  const [voteCount, setVoteCount] = useState(req.vote_count)
  const [showMessages, setShowMessages] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function vote() {
    if (voted || voting) return
    setVoting(true)
    const res = await fetch(`/api/connector-requests/${req.id}/vote`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setVoted(true)
      setVoteCount(data.vote_count ?? voteCount + 1)
      onVote(req.id, data.vote_count)
    }
    setVoting(false)
  }

  async function loadMessages() {
    if (!req.is_own) return
    const res = await fetch(`/api/connector-requests/${req.id}/messages`)
    if (res.ok) setMessages(await res.json())
  }

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    const res = await fetch(`/api/connector-requests/${req.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setReply('')
    }
    setSending(false)
  }

  const adminMessages = messages.filter(m => m.sender_type === 'admin')

  return (
    <div className={`rounded-xl border bg-card overflow-hidden transition-all ${voted ? 'border-primary/30' : 'border-border'}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Vote button */}
        <button
          onClick={vote}
          disabled={voted || voting || req.is_own}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all shrink-0 min-w-[44px] ${
            voted
              ? 'bg-primary/15 text-primary cursor-default'
              : 'bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer'
          }`}
          title={voted ? 'Already voted' : 'Vote for this connector'}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${voted ? 'fill-current' : ''}`} />
          <span className="text-[11px] font-bold">{voteCount}</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{req.connector_name}</p>
            {(() => {
              const { label, className } = getStatusDisplay(req)
              return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${className}`}>{label}</span>
            })()}
            {req.is_own && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                Your request
              </span>
            )}
          </div>
          {req.website_url && (
            <a
              href={req.website_url.startsWith('http') ? req.website_url : `https://${req.website_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground/60 hover:text-primary truncate block mt-0.5"
            >
              {req.website_url}
            </a>
          )}
          {req.use_case && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.use_case}</p>
          )}
        </div>

        {/* Messages toggle (only for own requests) */}
        {req.is_own && (
          <button
            onClick={() => {
              setShowMessages(m => !m)
              if (!showMessages) loadMessages()
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors shrink-0 relative"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {adminMessages.length > 0 && !showMessages && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {adminMessages.length}
              </span>
            )}
            {showMessages ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Message thread (own requests only) */}
      {showMessages && req.is_own && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No messages yet. The team will reach out here if they need more info.</p>
          ) : (
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.sender_type === 'admin'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {m.sender_type === 'admin' && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-60">OrbitAPI Team</p>
                    )}
                    <p className="text-xs leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
              placeholder="Reply to the team…"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()} className="gap-1">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function RequestConnectorForm() {
  const [requests, setRequests] = useState<CommunityRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Form state
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [useCase, setUseCase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'created' | 'voted' | 'already_voted' | null; connectorName?: string; voteCount?: number }>({ type: null })
  const [error, setError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const res = await fetch('/api/connector-requests')
    if (res.ok) setRequests(await res.json())
    setLoadingRequests(false)
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  function handleVote(id: string, newCount: number) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, vote_count: newCount, has_voted: true } : r))
  }

  async function submit() {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/connector-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connector_name: name, use_case: useCase, website_url: websiteUrl }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      return
    }

    if (data.duplicate && data.already_voted) {
      setResult({ type: 'already_voted', connectorName: name })
    } else if (data.duplicate && data.voted) {
      setResult({ type: 'voted', connectorName: data.request?.connector_name ?? name, voteCount: data.request?.vote_count })
      await loadRequests()
    } else if (data.created) {
      setResult({ type: 'created', connectorName: name })
      await loadRequests()
    }
  }

  const displayedRequests = showAll ? requests : requests.slice(0, 5)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Community requests list */}
      {!loadingRequests && requests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Community requests</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requests.length} connector{requests.length !== 1 ? 's' : ''} requested · vote to prioritize
              </p>
            </div>
            {!open && (
              <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
                + Request connector
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {displayedRequests.map(req => (
              <RequestCard key={req.id} req={req} onVote={handleVote} />
            ))}
            {requests.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
              >
                {showAll ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show {requests.length - 5} more</>}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Submission result */}
      {result.type === 'created' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center space-y-2">
          <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold">Request submitted!</p>
          <p className="text-xs text-muted-foreground">
            <strong>{result.connectorName}</strong>{' '}has been added to the request queue. We&apos;ll reach out here if we need more info.
          </p>
          <button onClick={() => { setResult({ type: null }); setName(''); setWebsiteUrl(''); setUseCase(''); setOpen(false) }}
            className="text-xs underline text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      )}

      {result.type === 'voted' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
          <ThumbsUp className="h-6 w-6 text-primary mx-auto" />
          <p className="text-sm font-semibold">Vote added!</p>
          <p className="text-xs text-muted-foreground">
            <strong>{result.connectorName}</strong> already has a request open — now at {result.voteCount} votes.
          </p>
          <button onClick={() => { setResult({ type: null }); setName(''); setWebsiteUrl(''); setUseCase(''); setOpen(false) }}
            className="text-xs underline text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      )}

      {result.type === 'already_voted' && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 text-center space-y-2">
          <Clock className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">Already under consideration</p>
          <p className="text-xs text-muted-foreground">
            You&apos;ve already voted for <strong>{result.connectorName}</strong>. We&apos;ll notify you when it&apos;s ready.
          </p>
          <button onClick={() => setResult({ type: null })} className="text-xs underline text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      )}

      {/* Request form */}
      {result.type === null && (
        <>
          {!open && requests.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Don&apos;t see what you need?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Request a connector — our team will build it and notify you when it&apos;s ready.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
                Request connector
              </Button>
            </div>
          )}

          {open && (
            <div className="rounded-xl border p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold">Request a connector</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tell us what service you want to connect. If it&apos;s already been requested, your submission will add a vote instead.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-name">Connector name <span className="text-destructive">*</span></Label>
                <Input
                  id="req-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Splunk, CrowdStrike, Airbnb, GitHub…"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-url">
                  Website / API docs URL <span className="text-muted-foreground font-normal">(optional but helpful)</span>
                </Label>
                <Input
                  id="req-url"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://developer.example.com/api"
                  type="url"
                />
                <p className="text-[11px] text-muted-foreground">
                  A link to the API documentation helps us build the connector accurately.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-usecase">
                  What would you use it for? <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <textarea
                  id="req-usecase"
                  value={useCase}
                  onChange={e => setUseCase(e.target.value)}
                  rows={2}
                  placeholder="e.g. Alert on suspicious logins from Splunk and auto-isolate the endpoint via CrowdStrike"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button onClick={submit} disabled={submitting || !name.trim()} size="sm">
                  {submitting ? 'Checking…' : 'Submit request'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Check, X, ChevronDown, ChevronUp, Loader2, FileCode2, Terminal,
  Tag, Image as ImageIcon, MessageSquare, Send, ThumbsUp, Globe, AlertCircle,
  Rocket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Request {
  id: string
  connector_name: string
  website_url: string | null
  use_case: string | null
  status: 'pending' | 'approved' | 'rejected'
  vote_count: number
  admin_notes: string | null
  created_at: string
  workspace: { name: string } | null
  profile: { email: string; full_name: string | null } | null
}

interface ConnectorBuild {
  id: string
  connector_slug: string | null
  status: 'generating' | 'complete' | 'failed'
  manifest_code: string | null
  catalog_entry: string | null
  import_line: string | null
  export_entry: string | null
  logo_svg: string | null
  error: string | null
  applied_at: string | null
}

interface Message {
  id: string
  sender_type: 'admin' | 'user'
  sender: { email: string; full_name: string | null } | null
  content: string
  created_at: string
  read_at: string | null
}

const STATUS_STYLES = {
  pending:  'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted/60 text-muted-foreground hover:bg-muted">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ icon: Icon, filename, code }: { icon: React.ElementType; filename: string; code: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono text-muted-foreground flex-1">{filename}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10"><CopyButton text={code} /></div>
          <pre className="p-4 text-xs text-zinc-200 overflow-x-auto bg-[#0d0d0d] max-h-80 overflow-y-auto leading-relaxed font-mono">{code}</pre>
        </div>
      )}
    </div>
  )
}

function LogoPreview({ slug, svg }: { slug: string; svg: string }) {
  const [open, setOpen] = useState(false)
  const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono text-muted-foreground flex-1">public/logos/{slug}.svg</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 py-4 flex items-center gap-6 bg-muted/10">
          {/* Rendered preview at multiple sizes */}
          <div className="flex items-end gap-3">
            {[64, 40, 28].map(size => (
              <div key={size} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUri} alt={slug} width={size} height={size} className="rounded-lg" />
                <span className="text-[9px] text-muted-foreground">{size}px</span>
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-2">Raw SVG</p>
            <div className="relative">
              <div className="absolute top-1 right-1 z-10"><CopyButton text={svg} /></div>
              <pre className="p-3 text-[11px] text-zinc-200 overflow-x-auto bg-[#0d0d0d] rounded-lg max-h-32 overflow-y-auto leading-relaxed font-mono">{svg}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConnectorRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [builds, setBuilds] = useState<Record<string, ConnectorBuild | null>>({})
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [buildExpanded, setBuildExpanded] = useState<string | null>(null)
  const [msgExpanded, setMsgExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({})
  const [sendingMsg, setSendingMsg] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [appliedFiles, setAppliedFiles] = useState<Record<string, string[]>>({})
  const [disabling, setDisabling] = useState<string | null>(null)

  const fetchBuild = useCallback(async (requestId: string) => {
    const res = await fetch(`/api/admin/connector-requests/${requestId}/build`)
    if (res.ok) {
      const data = await res.json()
      setBuilds(prev => ({ ...prev, [requestId]: data }))
    }
  }, [])

  const fetchMessages = useCallback(async (requestId: string) => {
    const res = await fetch(`/api/admin/connector-requests/${requestId}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(prev => ({ ...prev, [requestId]: data }))
    }
  }, [])

  useEffect(() => {
    fetch('/api/admin/connector-requests')
      .then(r => r.json())
      .then((data: Request[]) => {
        const list = Array.isArray(data) ? data : []
        setRequests(list)
        setLoading(false)
        list.filter(r => r.status === 'approved').forEach(r => fetchBuild(r.id))
      })
  }, [fetchBuild])

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const res = await fetch(`/api/admin/connector-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes: notes[id] ?? null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
      if (updated.build) {
        setBuilds(prev => ({ ...prev, [id]: updated.build }))
        setBuildExpanded(id)
      }
      setExpanded(null)
    }
    setActing(null)
  }

  async function applyBuild(buildId: string) {
    setApplying(buildId)
    const res = await fetch(`/api/admin/connector-builds/${buildId}/apply`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setAppliedFiles(prev => ({ ...prev, [buildId]: data.filesWritten ?? [] }))
      // Update build record in state so applied_at is set
      setBuilds(prev => {
        const entry = Object.entries(prev).find(([, b]) => b?.id === buildId)
        if (!entry) return prev
        const [reqId, b] = entry
        return { ...prev, [reqId]: b ? { ...b, applied_at: new Date().toISOString() } : b }
      })
    }
    setApplying(null)
  }

  async function toggleDisable(slug: string, currentlyDisabled: boolean) {
    setDisabling(slug)
    await fetch(`/api/admin/connectors/${encodeURIComponent(slug)}/disable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !currentlyDisabled }),
    })
    setDisabling(null)
  }

  async function sendMessage(requestId: string) {
    const content = msgDraft[requestId]?.trim()
    if (!content) return
    setSendingMsg(requestId)
    const res = await fetch(`/api/admin/connector-requests/${requestId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => ({ ...prev, [requestId]: [...(prev[requestId] ?? []), msg] }))
      setMsgDraft(prev => ({ ...prev, [requestId]: '' }))
    }
    setSendingMsg(null)
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)
  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const r of requests) counts[r.status]++

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Connector Requests</h1>
        <p className="text-muted-foreground mt-1">{requests.length} total · approve to auto-build with AI</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize
              ${filter === f ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {f}
            {f !== 'all' && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                f === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                f === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                'bg-red-500/15 text-red-400'}`}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center border border-dashed rounded-xl text-muted-foreground">
            No {filter === 'all' ? '' : filter} requests
          </div>
        )}

        {filtered.map(req => {
          const isOpen = expanded === req.id
          const isBuildOpen = buildExpanded === req.id
          const isMsgOpen = msgExpanded === req.id
          const build = builds[req.id]
          const building = acting === req.id
          const reqMessages = messages[req.id] ?? []
          const unreadCount = reqMessages.filter(m => m.sender_type === 'user' && !m.read_at).length

          return (
            <div key={req.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{req.connector_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[req.status]}`}>
                      {req.status}
                    </span>
                    {/* Vote count badge */}
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      <ThumbsUp className="h-2.5 w-2.5" />
                      {req.vote_count} vote{req.vote_count !== 1 ? 's' : ''}
                    </span>
                    {build?.connector_slug && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-muted text-muted-foreground">
                        {build.connector_slug}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>{req.profile?.email ?? '—'} · {req.workspace?.name ?? '—'} · {new Date(req.created_at).toLocaleDateString()}</p>
                    {req.website_url && (
                      <a href={req.website_url.startsWith('http') ? req.website_url : `https://${req.website_url}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary/70 hover:text-primary w-fit">
                        <Globe className="h-3 w-3" /> {req.website_url}
                      </a>
                    )}
                  </div>

                  {req.use_case && (
                    <p className="text-sm text-muted-foreground/80 leading-relaxed">{req.use_case}</p>
                  )}

                  {!req.website_url && req.status === 'pending' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                      <AlertCircle className="h-3 w-3" />
                      No website URL provided — consider asking for more info before building
                    </div>
                  )}

                  {req.admin_notes && (
                    <p className="text-xs text-muted-foreground/60 italic">Note: {req.admin_notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {/* Messages button */}
                  <button
                    onClick={() => {
                      setMsgExpanded(isMsgOpen ? null : req.id)
                      if (!isMsgOpen) fetchMessages(req.id)
                    }}
                    className="relative flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {unreadCount > 0 && !isMsgOpen && (
                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                        {unreadCount}
                      </span>
                    )}
                    {isMsgOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {/* Build output button (approved) */}
                  {req.status === 'approved' && build && (
                    <button
                      onClick={() => setBuildExpanded(isBuildOpen ? null : req.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
                      {building
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Building…</>
                        : build.status === 'complete'
                          ? <><FileCode2 className="h-3 w-3 text-emerald-400" /> Code {isBuildOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
                          : <><X className="h-3 w-3 text-red-400" /> Build failed</>
                      }
                    </button>
                  )}

                  {/* Respond button (pending) */}
                  {req.status === 'pending' && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : req.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
                      Respond {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Message thread */}
              {isMsgOpen && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message thread</p>
                  {reqMessages.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-2">No messages yet</p>
                    : (
                      <div className="space-y-2">
                        {reqMessages.map(m => (
                          <div key={m.id} className={`flex gap-2 ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.sender_type === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                              <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                                {m.sender_type === 'admin' ? 'You' : (m.sender?.email ?? 'User')}
                              </p>
                              <p className="text-xs leading-relaxed">{m.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  <div className="flex gap-2">
                    <input
                      value={msgDraft[req.id] ?? ''}
                      onChange={e => setMsgDraft(prev => ({ ...prev, [req.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(req.id) } }}
                      placeholder="Ask for more info, or share an update…"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button size="sm" onClick={() => sendMessage(req.id)} disabled={sendingMsg === req.id || !msgDraft[req.id]?.trim()} className="gap-1">
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Respond panel (pending → approve/reject) */}
              {isOpen && req.status === 'pending' && (
                <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                  <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-xs space-y-1 text-muted-foreground">
                    <p className="font-semibold text-foreground/70">Before approving, verify:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>The API has public documentation (check the website URL above)</li>
                      <li>Authentication is standard (API key, OAuth2, or similar)</li>
                      <li>The API is not behind an NDA or special enterprise contract</li>
                      <li>The connector name maps to a real, specific product</li>
                    </ul>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Admin note (optional, shown internally)"
                    value={notes[req.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
                  />
                  <div className="flex gap-2 items-center">
                    <Button size="sm" onClick={() => updateStatus(req.id, 'approved')} disabled={building}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      {building
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building…</>
                        : <><Check className="h-3.5 w-3.5" /> Approve &amp; Build</>
                      }
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'rejected')} disabled={building}
                      className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10">
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    {building && (
                      <p className="text-xs text-muted-foreground">Claude is generating the connector… ~20 seconds</p>
                    )}
                  </div>
                </div>
              )}

              {/* Build output (approved) */}
              {isBuildOpen && build && req.status === 'approved' && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-2">
                  {build.status === 'failed' ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                      <p className="font-semibold mb-1">Build failed</p>
                      <p className="font-mono">{build.error}</p>
                    </div>
                  ) : build.status === 'complete' ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <p className="text-xs font-semibold text-emerald-400">Build complete</p>
                        </div>
                        {(build.applied_at || appliedFiles[build.id]) ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <Check className="h-3.5 w-3.5" />
                            Applied to codebase
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1.5 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => applyBuild(build.id)}
                            disabled={applying === build.id}
                          >
                            {applying === build.id
                              ? <><Loader2 className="h-3 w-3 animate-spin" /> Applying…</>
                              : <><Rocket className="h-3 w-3" /> Apply to codebase</>
                            }
                          </Button>
                        )}
                      </div>
                      {appliedFiles[build.id] && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400/80 space-y-1 mb-2">
                          <p className="font-semibold">Files written:</p>
                          <ul className="list-disc list-inside space-y-0.5 font-mono">
                            {appliedFiles[build.id].map(f => <li key={f}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                      {build.manifest_code && <CodeBlock icon={FileCode2} filename={`connectors/${build.connector_slug}/index.ts`} code={build.manifest_code} />}
                      {build.catalog_entry && <CodeBlock icon={Tag} filename="connectors/catalog.ts → catalog array" code={build.catalog_entry} />}
                      {build.import_line && build.export_entry && (
                        <CodeBlock icon={Terminal} filename="connectors/index.ts"
                          code={`${build.import_line}\n// add ${build.export_entry} to the connectors array`} />
                      )}
                      {build.logo_svg && build.connector_slug && (
                        <LogoPreview slug={build.connector_slug} svg={build.logo_svg} />
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

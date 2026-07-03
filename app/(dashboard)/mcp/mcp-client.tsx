'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bot, Copy, Check, RefreshCw, ShieldCheck, Eye, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Endpoint {
  id: string
  token: string
  enabled: boolean
  created_at: string
}

export function McpClient({ isAdmin }: { isAdmin: boolean }) {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/mcp-endpoints')
      .then(r => r.json())
      .then(data => {
        setEndpoint(data.endpoint ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const url = endpoint?.enabled
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp/${endpoint.token}`
    : null

  async function enable(rotate = false) {
    setBusy(true)
    const res = await fetch('/api/mcp-endpoints', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setEndpoint(data.endpoint)
      toast.success(rotate ? 'New URL generated — the old one no longer works' : 'MCP access enabled')
    } else {
      toast.error(data.error ?? 'Something went wrong')
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    const res = await fetch('/api/mcp-endpoints', { method: 'DELETE' })
    if (res.ok) {
      setEndpoint(e => (e ? { ...e, enabled: false } : e))
      toast.success('MCP access disabled')
    }
    setBusy(false)
  }

  function copyUrl() {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      {/* Safety promises — this is the pitch */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: ShieldCheck, t: 'Credentials stay here', d: 'Your API keys never leave Orbit. The assistant only sees results.' },
          { icon: ClipboardCheck, t: 'Approvals still apply', d: 'Any action that changes something waits on the Approvals page.' },
          { icon: Eye, t: 'Everything is logged', d: 'Every call lands in your Audit Log, marked "External AI (MCP)".' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl border bg-card p-4 space-y-1.5">
            <Icon className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{t}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      {/* Endpoint control */}
      <div data-tour="mcp-endpoint" className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Your MCP server URL</h2>
        </div>

        {url ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 text-xs font-mono">{url}</code>
              <Button variant="outline" size="sm" onClick={copyUrl} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Treat this URL like a password — anyone who has it can read data through your connectors.
            </p>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => enable(true)} disabled={busy} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Generate new URL
                </Button>
                <Button variant="ghost" size="sm" onClick={disable} disabled={busy} className="text-destructive hover:text-destructive">
                  Disable
                </Button>
              </div>
            )}
          </>
        ) : isAdmin ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a private URL, paste it into your AI assistant, and your connected APIs show up there as tools.
            </p>
            <Button onClick={() => enable()} disabled={busy}>
              {busy ? 'Enabling…' : 'Enable MCP access'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            MCP access hasn&apos;t been enabled for this workspace yet — ask a workspace admin to turn it on here.
          </p>
        )}
      </div>

      {/* How to connect */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">How to connect</h2>
        <ol className="space-y-3 text-sm text-muted-foreground list-none">
          <li>
            <p className="font-medium text-foreground">Claude (claude.ai or desktop)</p>
            Settings → Connectors → <span className="font-medium">Add custom connector</span> → paste the URL above.
          </li>
          <li>
            <p className="font-medium text-foreground">ChatGPT</p>
            Settings → Connectors (requires developer mode) → <span className="font-medium">Add connector</span> → paste the URL.
          </li>
          <li>
            <p className="font-medium text-foreground">Cursor / other MCP clients</p>
            Add a server of type <span className="font-mono text-xs">streamable-http</span> with the URL above.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Then just ask your assistant things like <span className="italic">&quot;check my latest Stripe payments&quot;</span> —
          it will see your Orbit connectors as tools. Actions that change things get queued on the Approvals page
          instead of running immediately.
        </p>
      </div>
    </div>
  )
}

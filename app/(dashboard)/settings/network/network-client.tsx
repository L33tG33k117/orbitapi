'use client'

import { useMemo, useState } from 'react'
import { Download, Printer, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConnectorNetwork } from '@/lib/network-access'

// Matches the outline Button, but as a real <a> so the browser handles the
// download rather than us fetching a file into memory to re-save it.
const downloadLink =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background ' +
  'text-sm hover:bg-accent hover:text-accent-foreground transition-colors'

export function NetworkClient({
  connectors, connectedSlugs,
}: {
  connectors: ConnectorNetwork[]
  connectedSlugs: string[]
}) {
  // Default to what's actually connected. A security team asked to approve 100
  // hostnames for apps nobody uses will simply refuse; the short list is the
  // one that gets approved.
  const [onlyConnected, setOnlyConnected] = useState(connectedSlugs.length > 0)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    let list = connectors
    if (onlyConnected) list = list.filter(c => connectedSlugs.includes(c.slug))
    if (q.trim()) {
      const needle = q.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(needle) ||
        c.hosts.some(h => h.includes(needle)) ||
        (c.hostPattern ?? '').includes(needle))
    }
    return list
  }, [connectors, connectedSlugs, onlyConnected, q])

  const hosts = useMemo(
    () => [...new Set(rows.flatMap(c => c.hosts))].sort(),
    [rows],
  )
  const patterns = rows.filter(c => c.hostPattern)
  const lanOnly = rows.filter(c => c.customerHost)

  const query = onlyConnected ? '?connected=1' : ''

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">What to allow</h2>
        <p className="text-sm text-muted-foreground">
          OrbitAPI itself makes no outbound calls. Everything below is a service one of your
          connectors talks to. If your AI model runs on another machine, add that address too.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={`/api/admin/network${query}${query ? '&' : '?'}format=txt`} className={downloadLink}>
            <Download className="h-3.5 w-3.5" /> Download list (.txt)
          </a>
          <a href={`/api/admin/network${query}${query ? '&' : '?'}download=1`} className={downloadLink}>
            <Download className="h-3.5 w-3.5" /> Download rules (.json)
          </a>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search apps or hostnames" className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyConnected}
            onChange={e => setOnlyConnected(e.target.checked)}
            disabled={connectedSlugs.length === 0}
          />
          Only apps we&apos;ve connected ({connectedSlugs.length})
        </label>
      </div>

      {hosts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Allow these hostnames</h3>
          <pre className="rounded-xl border bg-muted/40 p-4 text-xs font-mono overflow-x-auto">{hosts.join('\n')}</pre>
        </section>
      )}

      {patterns.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">These depend on your own accounts</h3>
          <p className="text-xs text-muted-foreground">
            Replace the part in angle brackets with your own value — it&apos;s the same one you
            entered when connecting the app.
          </p>
          <div className="rounded-xl border divide-y">
            {patterns.map(c => (
              <div key={c.slug} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{c.name}</span>
                <code className="text-xs font-mono text-muted-foreground">{c.hostPattern}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      {lanOnly.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">No internet rule needed</h3>
          <p className="text-xs text-muted-foreground">
            You gave these an address yourself when connecting them. If that address is inside
            your own network, nothing needs to be opened to the internet at all.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lanOnly.map(c => (
              <span key={c.slug} className="px-2.5 py-1 rounded-full text-xs border bg-muted/40 text-muted-foreground">
                {c.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
          Nothing matches that search.
        </p>
      )}
    </div>
  )
}

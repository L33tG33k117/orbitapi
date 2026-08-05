import { Network } from 'lucide-react'
import Link from 'next/link'
import { connectorNetwork } from '@/lib/network-access'

// Shown on a connector's own page, because that is where someone hits the
// problem: they connect an app, it times out, and nothing on screen says the
// firewall is the reason. Naming the host here turns a support ticket into a
// copy-paste.
export function ConnectorNetworkCard({ slug }: { slug: string }) {
  const net = connectorNetwork(slug)
  if (!net || net.simulated) return null

  const hasSomething = net.hosts.length > 0 || net.hostPattern || net.customerHost
  if (!hasSomething) return null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Outbound network access</h3>
      </div>

      {net.customerHost ? (
        <p className="text-xs text-muted-foreground">
          This connects to the address you entered yourself. If that server is inside your own
          network, no internet access is needed for it.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            If your network blocks outbound traffic by default, allow{' '}
            {net.hosts.length > 1 ? 'these hosts' : 'this host'}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {net.hosts.map(h => (
              <code key={h} className="px-2 py-1 rounded-md border bg-muted/40 text-xs font-mono">{h}</code>
            ))}
            {net.hostPattern && (
              <code className="px-2 py-1 rounded-md border bg-muted/40 text-xs font-mono">{net.hostPattern}</code>
            )}
          </div>
          {net.hostPattern && (
            <p className="text-[11px] text-muted-foreground">
              Replace the part in angle brackets with your own value — the same one you entered
              when connecting this app.
            </p>
          )}
        </>
      )}

      <Link href="/settings/network" className="inline-block text-xs text-primary hover:underline pt-1">
        See every address OrbitAPI needs
      </Link>
    </div>
  )
}

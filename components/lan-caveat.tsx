'use client'

import { Network } from 'lucide-react'
import { useIsSelfHost } from '@/components/config-provider'

// ============================================================
// "This only works inside your network" notice
// ============================================================
// Webhooks and the MCP endpoint both keep working on a self-hosted install —
// but only for callers that can actually reach the box. On cloud, a webhook URL
// works from anywhere; on an air-gapped install, a URL pasted into GitHub or
// Stripe will never be called, and the failure is completely silent.
//
// So we say it up front, on the page where someone copies that URL, rather
// than letting them find out days later when an automation never fires.
// ============================================================

export function LanCaveat({ feature }: { feature: 'webhooks' | 'mcp' }) {
  if (!useIsSelfHost()) return null

  const copy = feature === 'webhooks'
    ? 'Anything you want to trigger these webhooks — GitHub, Stripe, a monitoring tool — has to be able to reach this server. Services on the public internet cannot, unless your network team deliberately exposes it.'
    : 'Your AI assistant has to be able to reach this server to connect. That works from a laptop on the same network or VPN; a cloud-hosted assistant will not be able to.'

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
      <Network className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Reachable from your network only</p>
        <p className="text-xs text-muted-foreground">{copy}</p>
      </div>
    </div>
  )
}

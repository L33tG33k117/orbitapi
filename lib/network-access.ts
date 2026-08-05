import { getConnector, connectors } from '@/connectors'
import type { ConnectorManifest, NetworkAccess } from '@/connectors/types'

// ============================================================
// Firewall rules for a self-hosted install
// ============================================================
// The customer's security team denies outbound traffic by default. Before they
// can use a connector they need the exact hostnames it will reach — and they
// need it as something they can paste into a rule, not prose in a doc.
//
// So the same data drives three places: the per-connector page, an admin
// screen listing everything, and a downloadable JSON/text allowlist.
// ============================================================

export interface ConnectorNetwork {
  slug: string
  name: string
  category: string
  /** Concrete hostnames, ready to allow. */
  hosts: string[]
  /** A shape the customer completes, e.g. '<your-subdomain>.zendesk.com'. */
  hostPattern?: string
  /** The address is entirely customer-supplied — no internet rule needed. */
  customerHost: boolean
  /** Simulated connectors make no outbound requests at all. */
  simulated: boolean
}

function toEntry(slug: string, name: string, category: string, net: NetworkAccess | undefined, simulated: boolean): ConnectorNetwork {
  return {
    slug,
    name,
    category,
    hosts: net?.hosts ?? [],
    hostPattern: net?.hostPattern,
    customerHost: !!net?.customerHost,
    simulated,
  }
}

/** Network requirements for one connector. */
export function connectorNetwork(slug: string): ConnectorNetwork | null {
  const m = getConnector(slug)
  if (!m) return null
  return toEntry(m.slug, m.name, m.category, m.network, m.isSimulated)
}

/** Network requirements for every connector in the build. */
export function allConnectorNetworks(): ConnectorNetwork[] {
  return (connectors as ConnectorManifest[])
    .map(m => toEntry(m.slug, m.name, m.category, m.network, m.isSimulated))
    .sort((a: ConnectorNetwork, b: ConnectorNetwork) => a.name.localeCompare(b.name))
}

/**
 * Flat, de-duplicated allowlist for a set of connectors.
 *
 * Patterns are returned separately: a firewall rule can't contain
 * `<your-subdomain>`, and silently dropping those would produce an allowlist
 * that looks complete and quietly omits the connectors the customer most
 * needs to think about.
 */
export function allowlistFor(slugs?: string[]): { hosts: string[]; patterns: { slug: string; name: string; pattern: string }[] } {
  const all = allConnectorNetworks()
  const chosen = slugs ? all.filter(c => slugs.includes(c.slug)) : all

  const hosts = new Set<string>()
  const patterns: { slug: string; name: string; pattern: string }[] = []

  for (const c of chosen) {
    if (c.simulated) continue
    for (const h of c.hosts) hosts.add(h)
    if (c.hostPattern) patterns.push({ slug: c.slug, name: c.name, pattern: c.hostPattern })
  }

  return { hosts: [...hosts].sort(), patterns }
}

/** A plain-text allowlist, one host per line — paste-able into most firewalls. */
export function allowlistText(slugs?: string[]): string {
  const { hosts, patterns } = allowlistFor(slugs)
  const lines = [
    '# OrbitAPI — outbound hosts to allow',
    '# Generated from the connectors in this installation.',
    '',
    ...hosts,
  ]
  if (patterns.length) {
    lines.push(
      '',
      '# These depend on your own account and must be completed by you:',
      ...patterns.map(p => `# ${p.name}: ${p.pattern}`),
    )
  }
  lines.push(
    '',
    '# OrbitAPI itself needs no outbound access.',
    '# The only other destination is your AI model server, if it runs elsewhere.',
  )
  return lines.join('\n')
}

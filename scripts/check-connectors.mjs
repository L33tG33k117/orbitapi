/**
 * Connector integrity check.
 *
 * The guarantee for every connector — whether hand-written or built from a
 * request via the tool — that it is correctly wired and won't 404 or duplicate:
 *
 *   1. No duplicate slugs in the catalog.
 *   2. No duplicate names among available connectors (catches placeholder vs.
 *      built duplicates like the QuickBooks case).
 *   3. Every available catalog entry has a matching code manifest (and vice-versa).
 *   4. Each manifest has the required fields + at least one action, and every
 *      action has slug/name/description/risk/inputSchema/execute with a valid risk.
 *   5. No duplicate action slugs within a connector.
 *   6. Logo file exists for connectors that declare a logoUrl.
 *
 * Pairs with test-sim-parity.mjs (simulated-data coverage).
 *
 * Usage:  node --no-warnings scripts/check-connectors.mjs   (or: npm run check:connectors)
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

register('./scripts/sim-alias-hook.mjs', pathToFileURL(process.cwd() + '/').href)
const root = pathToFileURL(process.cwd() + '/').href
const { connectors } = await import(root + 'connectors/index.ts')
const { catalog } = await import(root + 'connectors/catalog.ts')

const errors = []
const RISKS = new Set(['read', 'write', 'destructive'])

// 1. Duplicate slugs in catalog
const slugSeen = new Map()
for (const e of catalog) slugSeen.set(e.slug, (slugSeen.get(e.slug) ?? 0) + 1)
for (const [slug, n] of slugSeen) if (n > 1) errors.push(`Catalog: duplicate slug '${slug}' (${n}×)`)

// 2. Duplicate names anywhere in the catalog — two cards with the same name is
//    always confusing (this is the placeholder-vs-built duplicate, e.g. QuickBooks).
const nameSeen = new Map()
for (const e of catalog) {
  const key = e.name.toLowerCase().trim()
  if (!nameSeen.has(key)) nameSeen.set(key, [])
  nameSeen.get(key).push(e.slug)
}
for (const [name, slugs] of nameSeen) if (slugs.length > 1) errors.push(`Catalog: duplicate name "${name}" across slugs [${slugs.join(', ')}]`)

// 3. Catalog ↔ code manifest parity
const codeSlugs = new Set(connectors.map(c => c.slug))
for (const e of catalog.filter(c => c.available)) {
  if (!codeSlugs.has(e.slug)) errors.push(`Catalog: '${e.slug}' is available:true but has no code manifest in connectors/index.ts`)
}
const catalogBySlug = new Map(catalog.map(e => [e.slug, e]))
for (const m of connectors) {
  const entry = catalogBySlug.get(m.slug)
  if (!entry) errors.push(`Manifest '${m.slug}' has no catalog entry`)
  else if (!entry.available) errors.push(`Manifest '${m.slug}' exists but its catalog entry is available:false`)
}

// 4 + 5. Manifest structure + actions
for (const m of connectors) {
  for (const f of ['slug', 'name', 'category', 'description', 'auth', 'testConnection', 'actions']) {
    if (m[f] === undefined || m[f] === null) errors.push(`Manifest '${m.slug}': missing field '${f}'`)
  }
  if (typeof m.testConnection !== 'function') errors.push(`Manifest '${m.slug}': testConnection is not a function`)
  if (!Array.isArray(m.actions) || m.actions.length === 0) {
    errors.push(`Manifest '${m.slug}': must declare at least one action`)
    continue
  }
  const actionSlugs = new Set()
  for (const a of m.actions) {
    const where = `Manifest '${m.slug}' action '${a?.slug ?? '?'}'`
    for (const f of ['slug', 'name', 'description', 'risk', 'inputSchema', 'execute']) {
      if (a?.[f] === undefined || a?.[f] === null) errors.push(`${where}: missing '${f}'`)
    }
    if (a?.risk && !RISKS.has(a.risk)) errors.push(`${where}: invalid risk '${a.risk}'`)
    if (typeof a?.execute !== 'function') errors.push(`${where}: execute is not a function`)
    if (a?.slug) {
      if (actionSlugs.has(a.slug)) errors.push(`${where}: duplicate action slug`)
      actionSlugs.add(a.slug)
    }
  }
}

// 5b. Every real connector states what it needs to reach.
//
// A self-hosted customer's firewall denies egress by default. If a connector
// can't say which hosts it talks to, they cannot write a rule for it, and the
// integration fails at runtime with a DNS error nobody can interpret. Failing
// the build is the only way this stays true as connectors are added — the
// factory derives it from a static baseUrl, so this really only catches
// function-baseUrl specs and hand-written manifests.
for (const m of connectors) {
  if (m.isSimulated) continue   // makes no outbound requests at all
  const net = m.network
  const declared = !!net && (
    (Array.isArray(net.hosts) && net.hosts.length > 0) ||
    (typeof net.hostPattern === 'string' && net.hostPattern.length > 0) ||
    net.customerHost === true
  )
  if (!declared) {
    errors.push(
      `Manifest '${m.slug}': no network access declared. Add hosts / hostPattern / customerHost ` +
      `to the spec so self-hosted customers can write a firewall rule for it.`,
    )
    continue
  }
  for (const h of net.hosts ?? []) {
    if (/^https?:\/\//.test(h) || h.includes('/')) {
      errors.push(`Manifest '${m.slug}': network host '${h}' should be a bare hostname, not a URL.`)
    }
  }
  // A pattern the customer completes must LOOK completable; a literal
  // hostname hiding in hostPattern would silently omit itself from the
  // generated allowlist.
  if (net.hostPattern && !net.hostPattern.includes('<')) {
    errors.push(
      `Manifest '${m.slug}': hostPattern '${net.hostPattern}' has no <placeholder>. ` +
      `Use hosts for a fixed hostname.`,
    )
  }
}

// 6. Logo files exist
for (const m of connectors) {
  if (m.logoUrl && m.logoUrl.startsWith('/logos/')) {
    const p = join(process.cwd(), 'public', m.logoUrl)
    if (!existsSync(p)) errors.push(`Manifest '${m.slug}': logoUrl ${m.logoUrl} has no file at public${m.logoUrl}`)
  }
}

console.log('Connector integrity check\n' + '='.repeat(60))
console.log(`Catalog entries: ${catalog.length} · available: ${catalog.filter(c => c.available).length} · code manifests: ${connectors.length}`)
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`)
  for (const e of errors) console.error(`  • ${e}`)
  process.exit(1)
}
console.log('\n✓ All connectors are wired correctly — no duplicates, complete manifests, valid actions.')

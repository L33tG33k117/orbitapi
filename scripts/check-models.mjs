#!/usr/bin/env node
/**
 * OrbitAPI model freshness check.
 *
 * Answers two questions against Anthropic's live Models API:
 *
 *   1. RETIREMENT (urgent)  — is any model we ship still being served?
 *      A retired model ID returns 404 at runtime, which means every skill run,
 *      playbook and chat message fails. This is the check that actually
 *      prevents an outage.
 *
 *   2. FRESHNESS (advisory) — has anything newer than our newest model shipped?
 *      Newer usually means better and often the same price, but adopting one is
 *      NOT automatic: model generations carry breaking changes (thinking
 *      defaults, removed parameters, different tokenizers) and the Models API
 *      does not publish pricing, so MODEL_PRICING has to be updated by hand or
 *      the app silently bills wrong. A human reads the migration notes.
 *
 * Deliberately dependency-free and read-only: parses the model IDs straight out
 * of lib/usage-cost.ts (the single source of truth) so it can never drift from
 * what the app actually calls.
 *
 * Usage:
 *   node scripts/check-models.mjs          human-readable report
 *   node scripts/check-models.mjs --json   machine-readable (used by CI)
 *
 * Exit codes: 0 = all good · 1 = newer models available · 2 = a model we use is
 * gone (or the check itself could not run).
 *
 * Needs ANTHROPIC_API_KEY (from the environment, or .env.local when run locally).
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')

// --- credentials -----------------------------------------------------------
// In CI the key comes from the environment; locally, fall back to .env.local
// the same way the other scripts in here do.
let apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey && existsSync(join(root, '.env.local'))) {
  const m = readFileSync(join(root, '.env.local'), 'utf8')
    .match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m)
  if (m) apiKey = m[1].trim().replace(/^["']|["']$/g, '')
}
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set — cannot check models.')
  process.exit(2)
}

// --- what the app currently ships ------------------------------------------
const source = readFileSync(join(root, 'lib', 'usage-cost.ts'), 'utf8')
const block = source.match(/MODEL_PRICING[^{]*\{([\s\S]*?)\n\}/)
if (!block) {
  console.error('Could not find MODEL_PRICING in lib/usage-cost.ts — has it moved?')
  process.exit(2)
}
const configured = [...block[1].matchAll(/'([^']+)'\s*:\s*\{/g)].map(m => m[1])
if (configured.length === 0) {
  console.error('Parsed MODEL_PRICING but found no model ids — check the regex.')
  process.exit(2)
}

// --- what Anthropic serves today -------------------------------------------
let available
try {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  })
  if (!res.ok) {
    console.error(`Models API returned ${res.status}: ${(await res.text()).slice(0, 300)}`)
    process.exit(2)
  }
  available = (await res.json()).data ?? []
} catch (err) {
  console.error(`Could not reach the Models API: ${err.message}`)
  process.exit(2)
}

const byId = new Map(available.map(m => [m.id, m]))
const ts = m => Date.parse(m?.created_at ?? 0) || 0

// The list endpoint returns concrete snapshots, but the app (correctly) calls
// undated ALIASES — `claude-haiku-4-5` is live and callable even though the
// list only shows `claude-haiku-4-5-20251001`. So absence from the list proves
// nothing. Resolve each configured id against the retrieve endpoint, which
// follows aliases, and treat only a 404 as retired.
async function resolve(id) {
  if (byId.has(id)) return byId.get(id)
  const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(id)}`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`retrieve ${id} -> ${res.status}`)
  return res.json()
}

const resolved = new Map()
const retired = []
for (const id of configured) {
  try {
    const model = await resolve(id)
    if (model) resolved.set(id, model)
    else retired.push(id)
  } catch (err) {
    console.error(`Could not verify ${id}: ${err.message}`)
    process.exitCode = 2
  }
}

// 2. freshness — anything released after the newest model we already use.
// Compared against the resolved snapshot dates so an alias counts as its
// underlying release, and aliases of models we already run never look "new".
const newestInUse = Math.max(0, ...[...resolved.values()].map(ts))
const resolvedIds = new Set([...resolved.values()].map(m => m.id))
const newer = available
  .filter(m => !configured.includes(m.id) && !resolvedIds.has(m.id) && ts(m) > newestInUse)
  .sort((a, b) => ts(b) - ts(a))

const result = {
  checkedAt: new Date().toISOString(),
  configured,
  retired,
  newer: newer.map(m => ({
    id: m.id,
    displayName: m.display_name,
    createdAt: m.created_at,
    contextWindow: m.max_input_tokens ?? null,
    maxOutput: m.max_tokens ?? null,
  })),
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log('='.repeat(60))
  console.log(`Models in use: ${configured.join(', ')}`)
  console.log('='.repeat(60))
  if (retired.length) {
    console.log(`\n✗ NO LONGER SERVED (the app will 404 on these): ${retired.join(', ')}`)
    console.log('  Replace them in lib/usage-cost.ts immediately.')
  }
  if (newer.length) {
    console.log(`\n→ ${newer.length} newer model(s) available:`)
    for (const m of result.newer) {
      console.log(`  · ${m.id} — ${m.displayName} (released ${m.createdAt?.slice(0, 10)})`)
    }
    console.log('\n  Adopting one is a manual step: update MODEL_PRICING in lib/usage-cost.ts')
    console.log('  (the Models API does not publish prices) and read the migration notes for')
    console.log('  breaking changes — thinking defaults and max_tokens interactions have bitten')
    console.log('  us before. See the thinking policy in lib/ai-resilience.ts.')
  }
  if (!retired.length && !newer.length) {
    console.log('\n✓ Everything current — no retirements, nothing newer.')
  }
}

// Set exitCode rather than calling process.exit(): an immediate exit while the
// fetch handles are still unwinding trips a libuv assertion on Windows.
if (retired.length) process.exitCode = 2
else if (newer.length) process.exitCode = 1

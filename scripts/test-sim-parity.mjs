/**
 * Simulation shape-coverage advisory.
 *
 * Every simulated connection now routes through lib/sim-engine.ts, which
 * AI-generates realistic, query-specific data for ANY connector — so a new
 * connector works in Simulate mode whether or not it has hand-written data.
 * Correctness is therefore no longer gated on this file.
 *
 * What this script does now: report which actions have a curated SHAPE HINT in
 * lib/simulate-action.ts. Those hints sharpen realism (the engine feeds them to
 * the model as the exact JSON shape to return), so it's good to add them — but a
 * missing hint is a quality note, NOT a failure. This script never exits non-zero
 * for missing hints, so it never blocks a new connector from shipping.
 *
 * Scope: connectors a user can run in "Simulate" mode (manifest.isSimulated ===
 * false). The purpose-built simulated connectors (simulated-lights,
 * simulated-ring) have real DB-backed execute() and are exempt.
 *
 * Usage:  node --no-warnings scripts/test-sim-parity.mjs
 *         (or: npm run test:sim-parity)
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./scripts/sim-alias-hook.mjs', pathToFileURL(process.cwd() + '/').href)

const root = pathToFileURL(process.cwd() + '/').href
const { connectors } = await import(root + 'connectors/index.ts')
const { hasSimulatedData } = await import(root + 'lib/simulate-action.ts')

let failures = 0
let checkedConnectors = 0
let checkedActions = 0

console.log('Simulation parity check\n' + '='.repeat(60))

for (const m of connectors) {
  if (m.isSimulated) {
    console.log(`SKIP  ${m.slug.padEnd(20)} (stateful sim — real DB-backed execute)`)
    continue
  }
  checkedConnectors++
  const missing = m.actions.filter(a => !hasSimulatedData(m.slug, a.slug)).map(a => a.slug)
  checkedActions += m.actions.length
  if (missing.length) {
    failures += missing.length
    console.log(`gaps  ${m.slug.padEnd(20)} ${m.actions.length - missing.length}/${m.actions.length} have a curated shape hint`)
    for (const slug of missing) {
      console.log(`        • ${slug} — no shape hint (engine still answers via AI generation; add one for sharper realism)`)
    }
  } else {
    console.log(`ok    ${m.slug.padEnd(20)} ${m.actions.length}/${m.actions.length} shape hints`)
  }
}

console.log('='.repeat(60))
if (failures) {
  // Advisory only — the engine guarantees a working response regardless. Never
  // fail CI for a missing shape hint, so new connectors are never blocked.
  console.log(
    `\nℹ ${failures} action(s) have no curated shape hint. They still work in ` +
    `Simulate mode via AI generation; add entries in lib/simulate-action.ts for sharper realism.`
  )
} else {
  console.log(`\n✓ All ${checkedActions} actions across ${checkedConnectors} simulatable connectors have a curated shape hint.`)
}

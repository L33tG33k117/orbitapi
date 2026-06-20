/**
 * Simulation parity test.
 *
 * Guarantees that every action a connector declares can be exercised in
 * simulated mode with realistic, bespoke fake data — never the generic stub.
 *
 * Why this matters: real connectors get type-level enforcement (ActionDef.execute
 * is required, so tsc won't compile a declared action with no implementation).
 * The simulation layer (lib/simulate-action.ts) has no such guarantee — its DATA
 * map is a loose lookup with a silent generic fallback. So the moment someone adds
 * an action and forgets the sim entry, a simulated connection returns
 * `{ __simulated: true, message: "..." }` instead of useful data — no error, no
 * build failure. This test turns that silent drift into a loud CI failure.
 *
 * Scope: only connectors that route through simulateAction() — i.e. real
 * connectors a user can run in "Simulate" mode (manifest.isSimulated === false).
 * The purpose-built simulated connectors (simulated-lights, simulated-ring) have
 * real DB-backed execute() and never touch simulateAction(), so they're exempt.
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
    console.log(`FAIL  ${m.slug.padEnd(20)} ${m.actions.length - missing.length}/${m.actions.length} covered`)
    for (const slug of missing) {
      console.log(`        ✗ ${slug} — no entry in lib/simulate-action.ts (would hit generic fallback)`)
    }
  } else {
    console.log(`ok    ${m.slug.padEnd(20)} ${m.actions.length}/${m.actions.length} covered`)
  }
}

console.log('='.repeat(60))
if (failures) {
  console.error(
    `\n✗ ${failures} declared action(s) have no simulated data.\n` +
    `  Add an entry under the matching connector in the DATA map in lib/simulate-action.ts.\n`
  )
  process.exit(1)
}
console.log(`\n✓ All ${checkedActions} actions across ${checkedConnectors} simulatable connectors have bespoke simulated data.`)

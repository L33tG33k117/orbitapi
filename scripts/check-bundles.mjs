/**
 * Bundle integrity check.
 *
 * Every vertical bundle must be installable and runnable:
 *   1. No duplicate bundle slugs.
 *   2. Every connector + alternative references an available code connector.
 *   3. Group connectorSlugs reference connectors the bundle declares.
 *   4. Playbook/skill groupKeys reference a group the bundle declares.
 *   5. Playbook action steps reference a declared connector + a real action slug.
 *
 * Usage:  node --no-warnings scripts/check-bundles.mjs   (or: npm run check:bundles)
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./scripts/sim-alias-hook.mjs', pathToFileURL(process.cwd() + '/').href)
const root = pathToFileURL(process.cwd() + '/').href
const { BUILTIN_BUNDLES } = await import(root + 'lib/bundle-registry.ts')
const { connectors } = await import(root + 'connectors/index.ts')

const actionsBySlug = new Map(connectors.map(c => [c.slug, new Set(c.actions.map(a => a.slug))]))
const errors = []
const seen = new Set()

for (const b of BUILTIN_BUNDLES) {
  if (seen.has(b.slug)) errors.push(`duplicate bundle slug '${b.slug}'`)
  seen.add(b.slug)

  const declared = new Set(b.connectors.map(c => c.slug))
  for (const c of b.connectors) {
    if (!actionsBySlug.has(c.slug)) errors.push(`${b.slug}: connector '${c.slug}' is not an available connector`)
    for (const alt of c.alternatives ?? []) {
      if (!actionsBySlug.has(alt)) errors.push(`${b.slug}: alternative '${alt}' is not an available connector`)
    }
  }

  const groupKeys = new Set(b.groups.map(g => g.key))
  for (const g of b.groups) {
    for (const s of g.connectorSlugs) {
      if (!declared.has(s)) errors.push(`${b.slug}: group '${g.key}' references undeclared connector '${s}'`)
    }
  }

  for (const p of b.playbooks) {
    if (!groupKeys.has(p.groupKey)) errors.push(`${b.slug}: playbook "${p.name}" has unknown groupKey '${p.groupKey}'`)
    for (const step of p.definition?.steps ?? []) {
      if (step.type === 'action') {
        if (!declared.has(step.connector_slug)) {
          errors.push(`${b.slug}: action step "${step.name}" references undeclared connector '${step.connector_slug}'`)
        } else if (!actionsBySlug.get(step.connector_slug)?.has(step.action_slug)) {
          errors.push(`${b.slug}: action step "${step.name}" — '${step.connector_slug}' has no action '${step.action_slug}'`)
        }
      }
    }
  }

  for (const s of b.skills) {
    if (!groupKeys.has(s.groupKey)) errors.push(`${b.slug}: skill "${s.name}" has unknown groupKey '${s.groupKey}'`)
  }
}

console.log('Bundle integrity check\n' + '='.repeat(60))
console.log(`Bundles: ${BUILTIN_BUNDLES.length}`)
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`)
  for (const e of errors) console.error(`  • ${e}`)
  process.exit(1)
}
console.log('\n✓ All bundles are valid — connectors, alternatives, groups, playbook actions, and skills all resolve.')

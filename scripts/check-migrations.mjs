#!/usr/bin/env node
/**
 * Guard: migrations must survive being replayed from an EMPTY database.
 *
 * The hosted database was built up incrementally over a year and never
 * replayed from scratch, so a migration that collides with an earlier one
 * could sit there indefinitely without anyone noticing — 014 did exactly that,
 * aborting halfway and still being recorded as applied, which silently cost us
 * the conversation_messages table until 042 repaired it.
 *
 * The self-hosted edition replays every migration on every fresh install, so
 * the same collision is a hard failure: the app container crash-loops and the
 * stack never comes up. This check catches it in CI instead.
 *
 * It is deliberately a STATIC check — no database needed, so it runs in the
 * fast `verify` job rather than only in the slow container job.
 *
 *   node scripts/check-migrations.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'supabase', 'migrations')
const errors = []

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()

// Sequence numbers must be unique and ordered, or "apply in order" is a lie.
const seq = new Map()
for (const f of files) {
  const n = f.match(/^(\d+)_/)?.[1]
  if (!n) { errors.push(`${f}: does not start with a sequence number`); continue }
  if (seq.has(n)) errors.push(`${f}: duplicate sequence number ${n} (also ${seq.get(n)})`)
  else seq.set(n, f)
}

/** Strip comments and string literals so we only match real SQL. */
function code(sql) {
  return sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .replace(/'[^']*'/g, "''")
}

const created = new Map()

for (const f of files) {
  const sql = code(readFileSync(join(DIR, f), 'utf8'))

  // Objects whose creation aborts the whole migration if they already exist.
  const objects = /create\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|type|publication|index|policy|trigger)\s+(?!if\s+not\s+exists)("[^"]+"|[a-z0-9_.]+)/gi
  let m
  while ((m = objects.exec(sql))) {
    const kind = m[1].toLowerCase()
    const raw = m[2].replace(/"/g, '').replace(/^public\./i, '').toLowerCase()
    if (kind === 'index' && raw === 'on') continue   // anonymous, auto-named

    const key = `${kind}:${raw}`
    if (created.has(key)) {
      errors.push(
        `${f}: re-creates ${kind} "${raw}", already created in ${created.get(key)}. ` +
        `On a fresh install this aborts the migration. Use IF NOT EXISTS, or make this file a no-op.`,
      )
    } else {
      created.set(key, f)
    }
  }

}

console.log('\nMigration replay check')
console.log('='.repeat(60))
console.log(`Files: ${files.length}\n`)

if (errors.length) {
  for (const e of errors) console.log(`  • ${e}`)
  console.log(`\n✗ ${errors.length} problem(s) — a fresh install would fail.\n`)
  process.exit(1)
}

console.log('✓ Migrations can be replayed from an empty database.\n')

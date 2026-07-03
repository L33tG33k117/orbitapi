#!/usr/bin/env node
/**
 * OrbitAPI migration runner (Supabase Management API).
 *
 * Applies SQL files from supabase/migrations/ to the linked Supabase project via
 * the Management API — no Postgres client, no CLI, just Node's built-in fetch.
 *
 * Credentials come from .env.local (gitignored) — never printed:
 *   SUPABASE_ACCESS_TOKEN   personal access token (supabase.com/dashboard/account/tokens)
 *   NEXT_PUBLIC_SUPABASE_URL used to derive the project ref
 *
 * Commands:
 *   node scripts/db-migrate.mjs status          list applied vs pending
 *   node scripts/db-migrate.mjs up              apply every pending migration in order
 *   node scripts/db-migrate.mjs apply <file>    run one migration file explicitly
 *   node scripts/db-migrate.mjs baseline        mark all current files applied WITHOUT running
 *                                               (adopt a DB whose schema already matches)
 *
 * A tracking table (public._orbit_migrations) records what has run, so re-runs are safe.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIG_DIR = join(ROOT, 'supabase', 'migrations')

// ── Load .env.local (KEY=VALUE, ignores quotes/comments) ─────────────────────
function loadEnv() {
  const env = {}
  let raw = ''
  try { raw = readFileSync(join(ROOT, '.env.local'), 'utf8') } catch { /* fall through */ }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[m[1]] = v
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const TOKEN = env.SUPABASE_ACCESS_TOKEN
const URL = env.NEXT_PUBLIC_SUPABASE_URL || ''
const REF = (URL.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1]

function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1) }

if (!TOKEN) fail(
  'SUPABASE_ACCESS_TOKEN is not set in .env.local.\n' +
  '  1. Create one at https://supabase.com/dashboard/account/tokens\n' +
  '  2. Add a line to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_your_token_here')
if (!REF) fail('Could not derive the project ref from NEXT_PUBLIC_SUPABASE_URL.')

// ── Run SQL via the Management API ───────────────────────────────────────────
async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) {
    // Never echo the token; surface the DB error only.
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`)
  }
  try { return JSON.parse(text) } catch { return [] }
}

async function ensureTracking() {
  await runSql(
    `create table if not exists public._orbit_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     );`)
}

async function appliedSet() {
  const rows = await runSql('select name from public._orbit_migrations;')
  return new Set((rows || []).map(r => r.name))
}

function migrationFiles() {
  return readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()
}

async function record(name) {
  await runSql(`insert into public._orbit_migrations (name) values (${quote(name)})
                on conflict (name) do nothing;`)
}
function quote(s) { return `'${String(s).replace(/'/g, "''")}'` }

async function applyFile(file) {
  const sql = readFileSync(join(MIG_DIR, file), 'utf8')
  process.stdout.write(`  → applying ${file} … `)
  await runSql(sql)
  await record(file)
  console.log('done')
}

// ── Commands ─────────────────────────────────────────────────────────────────
const [cmd, arg] = process.argv.slice(2)

async function main() {
  await ensureTracking()
  const applied = await appliedSet()
  const files = migrationFiles()
  const pending = files.filter(f => !applied.has(f))

  if (cmd === 'status' || !cmd) {
    console.log(`\nProject ref: ${REF}`)
    console.log(`Applied: ${applied.size}   Pending: ${pending.length}\n`)
    for (const f of files) console.log(`  ${applied.has(f) ? '✓' : '·'} ${f}`)
    if (pending.length) console.log(`\nRun "node scripts/db-migrate.mjs up" to apply ${pending.length} pending.`)
    console.log('')
    return
  }

  if (cmd === 'baseline') {
    const toMark = files.filter(f => !applied.has(f))
    for (const f of toMark) await record(f)
    console.log(`\n✓ Baselined ${toMark.length} migration(s) as already-applied (no SQL executed).\n`)
    return
  }

  if (cmd === 'apply') {
    if (!arg) fail('Usage: node scripts/db-migrate.mjs apply <filename>')
    const file = files.find(f => f === arg || f === basename(arg) || f.includes(arg))
    if (!file) fail(`No migration file matching "${arg}".`)
    await applyFile(file)
    console.log('')
    return
  }

  if (cmd === 'up') {
    if (!pending.length) { console.log('\n✓ Up to date — no pending migrations.\n'); return }
    console.log(`\nApplying ${pending.length} pending migration(s):`)
    for (const f of pending) await applyFile(f)
    console.log('\n✓ All migrations applied.\n')
    return
  }

  fail(`Unknown command "${cmd}". Use: status | up | apply <file> | baseline`)
}

main().catch(e => fail(e.message))

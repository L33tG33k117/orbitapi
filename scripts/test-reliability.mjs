#!/usr/bin/env node
/**
 * Production-readiness invariants from the launch checklist that are provable
 * by reading the code, so they run in CI with no app and no secrets.
 *
 *   Reliability — every connector call can time out, so one unresponsive
 *                 provider cannot hang a request or drain a scheduled run.
 *   Security    — credentials never reach a log line.
 *
 *   node scripts/test-reliability.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
let passed = 0, failed = 0
const check = (label, ok, detail) => {
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`) }
}
const read = (f) => existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : ''

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

// ── Reliability: connector requests time out ────────────────────────────────
console.log('Reliability: every connector request can time out')

const factory = read('connectors/factory.ts')
check('the REST factory applies a timeout to every request',
  /signal: AbortSignal\.timeout\(/.test(factory))
check('a timed-out request says so instead of "request failed"',
  /did not respond within/.test(factory))
check('an unusually slow API can raise the limit per connector',
  /timeoutMs\?: number/.test(factory) && /spec\.timeoutMs \?\?/.test(factory))

// Hand-written connectors call fetch themselves. Each one must go through the
// shared helper — a bare fetch( here is the exact hole this suite exists for.
const connectorFiles = walk(join(ROOT, 'connectors'))
const bare = []
for (const file of connectorFiles) {
  const rel = relative(ROOT, file).split(String.fromCharCode(92)).join(String.fromCharCode(47))
  if (rel.endsWith('connectors/factory.ts') || rel.endsWith('connectors/timeout.ts')) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    // `await fetch(` / `= fetch(` but not fetchWithTimeout
    if (/\bfetch\(/.test(line) && !/fetchWithTimeout\(/.test(line)) bare.push(`${rel}:${i + 1}`)
  })
}
check('no connector calls fetch() without the shared timeout', bare.length === 0,
  bare.length ? `use fetchWithTimeout from @/connectors/timeout:\n      ${bare.join('\n      ')}` : '')

// ── Security: credentials never reach a log ─────────────────────────────────
console.log('\nSecurity: credentials never reach a log line')

const CRED_WORDS = /(creds|credentials|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|password|signing_secret|webhook_secret|serviceRoleKey|SERVICE_ROLE)/
const logged = []
for (const file of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...connectorFiles]) {
  const rel = relative(ROOT, file).split(String.fromCharCode(92)).join(String.fromCharCode(47))
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!/console\.(log|warn|error|info|debug)\(/.test(line)) return
    // The identifier must be logged, not merely mentioned in a message string.
    const args = line.slice(line.indexOf('console.'))
    const withoutStrings = args.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``')
    if (CRED_WORDS.test(withoutStrings)) logged.push(`${rel}:${i + 1}`)
  })
}
check('no console call passes a credential value', logged.length === 0,
  logged.length ? `log an identifier or a redacted shape instead:\n      ${logged.join('\n      ')}` : '')

// storeSecret is the only place credentials should be written down at all.
const creds = read('lib/credentials.ts')
check('credentials are stored through a single module', creds.includes('export async function storeSecret'))

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1

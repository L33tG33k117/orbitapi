#!/usr/bin/env node
/**
 * Re-encrypt legacy `inline:` secrets with ORBIT_SECRETS_KEY.
 *
 * `inline:<base64>` was never encryption — it was the fallback used when
 * Supabase Vault wasn't available. Any row still in that format is storing a
 * credential in plain, reversible base64. This upgrades them in place to
 * AES-256-GCM (`enc:v1:…`).
 *
 * Safe to re-run: rows already encrypted, in Vault, or holding only the
 * simulated marker are skipped.
 *
 *   node scripts/reencrypt-secrets.mjs --dry-run   report what would change
 *   node scripts/reencrypt-secrets.mjs             do it
 *
 * Requires ORBIT_SECRETS_KEY plus either DATABASE_URL (self-hosted) or the
 * Supabase service-role env the app already uses.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createCipheriv, randomBytes } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  let raw = ''
  try { raw = readFileSync(join(ROOT, '.env.local'), 'utf8') } catch { /* ignore */ }
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
const DRY = process.argv.includes('--dry-run')

function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1) }

const rawKey = env.ORBIT_SECRETS_KEY
if (!rawKey) fail('ORBIT_SECRETS_KEY is not set — nothing to re-encrypt to.')
const KEY = /^[0-9a-f]{64}$/i.test(rawKey) ? Buffer.from(rawKey, 'hex') : Buffer.from(rawKey, 'base64')
if (KEY.length !== 32) fail('ORBIT_SECRETS_KEY must decode to exactly 32 bytes.')

function encrypt(payload) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`
}

// ── Data access: direct Postgres, or Supabase service role ───────────────────
async function withRows(handler) {
  if (env.DATABASE_URL) {
    const { default: pg } = await import('pg')
    const client = new pg.Client({
      connectionString: env.DATABASE_URL,
      ssl: /[?&]sslmode=(require|verify)/.test(env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
    })
    await client.connect()
    try {
      const { rows } = await client.query(
        "select id, vault_secret_id from connections where vault_secret_id like 'inline:%'")
      await handler(rows, async (id, value) => {
        await client.query('update connections set vault_secret_id = $1 where id = $2', [value, id])
      })
    } finally {
      await client.end()
    }
    return
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('Set DATABASE_URL, or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.')
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await db
    .from('connections').select('id, vault_secret_id').like('vault_secret_id', 'inline:%')
  if (error) fail(error.message)
  await handler(data ?? [], async (id, value) => {
    const { error: upErr } = await db.from('connections').update({ vault_secret_id: value }).eq('id', id)
    if (upErr) throw new Error(upErr.message)
  })
}

await withRows(async (rows, update) => {
  console.log(`\nFound ${rows.length} row(s) using the legacy inline format.`)
  let changed = 0
  let skipped = 0

  for (const row of rows) {
    let payload
    try {
      payload = JSON.parse(Buffer.from(row.vault_secret_id.slice(7), 'base64').toString('utf8'))
    } catch {
      console.log(`  · ${row.id} — unreadable, left alone`)
      skipped++
      continue
    }

    // Simulated connections carry a marker, not a credential. Encrypting it
    // would cost a decrypt on every read to learn nothing secret.
    if (payload && payload.__simulated) {
      skipped++
      continue
    }

    if (DRY) {
      console.log(`  → ${row.id} would be encrypted (${Object.keys(payload).join(', ')})`)
      changed++
      continue
    }

    await update(row.id, encrypt(payload))
    console.log(`  ✓ ${row.id} encrypted`)
    changed++
  }

  console.log(`\n${DRY ? 'Would encrypt' : 'Encrypted'}: ${changed}   Skipped: ${skipped}\n`)
  if (DRY && changed) console.log('Re-run without --dry-run to apply.\n')
})

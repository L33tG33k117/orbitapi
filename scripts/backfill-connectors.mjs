/**
 * Backfill the `connectors` DB table from the code catalog.
 *
 * Every available connector needs a row in public.connectors — /api/connections
 * looks up connectors.id for the connection FK. Connectors added via migration
 * seeds already have rows; connectors built from approved requests did NOT (the
 * apply step only wrote files), which caused "Connector not found in database".
 * The apply route now seeds the row going forward; this script repairs any
 * connector that was applied before that fix (e.g. QuickBooks Online).
 *
 * Idempotent — upserts on slug, so it's safe to run repeatedly.
 *
 * Usage:  node scripts/backfill-connectors.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dir, '../.env.local'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// catalog.ts has no runtime imports (type-only), so Node 24 can import it directly.
const { catalog } = await import(pathToFileURL(join(__dir, '../connectors/catalog.ts')).href)
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

// Only connectors that actually have a manifest (available) belong in the DB.
const available = catalog.filter(c => c.available)

const { data: existing } = await admin.from('connectors').select('slug')
const have = new Set((existing ?? []).map(r => r.slug))

const missing = available.filter(c => !have.has(c.slug))
if (missing.length === 0) {
  console.log(`✓ All ${available.length} available connectors already have DB rows. Nothing to backfill.`)
  process.exit(0)
}

console.log(`Backfilling ${missing.length} missing connector row(s): ${missing.map(c => c.slug).join(', ')}`)

const { error } = await admin.from('connectors').upsert(
  missing.map(c => ({
    slug: c.slug,
    name: c.name,
    category: c.category,
    manifest: { description: c.description },
    is_simulated: !!c.isSimulated,
  })),
  { onConflict: 'slug' },
)

if (error) {
  console.error('✗ Backfill failed:', error.message)
  process.exit(1)
}
console.log('✓ Backfill complete.')

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ApplyInput {
  slug: string
  connectorName: string
  manifestCode: string
  catalogEntryStr: string // JS object literal from AI
  importLine: string
  exportEntry: string
  logoSvg: string | null
  simulatedData?: Record<string, unknown> | null  // actionSlug -> sample `data`
}

export interface ApplyResult {
  ok: boolean
  error?: string
  filesWritten: string[]
  // Resolved catalog metadata — used to seed the `connectors` DB row so the
  // connector is actually connectable (the connections API needs that row).
  meta: { slug: string; name: string; category: string; description: string }
}

// eslint-disable-next-line no-new-func
function parseCatalogEntry(str: string): Record<string, unknown> | null {
  try {
    return new Function(`return (${str})`)() as Record<string, unknown>
  } catch {
    return null
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Drop the catalog line for an exact slug (so re-applying replaces, not duplicates).
function removeCatalogEntryBySlug(text: string, slug: string): string {
  return text.replace(new RegExp(`\\n\\s*\\{\\s*slug:\\s*'${escapeRegExp(slug)}'[^\\n]*\\},`, 'g'), '')
}

// Drop any "coming soon" (available: false) line for the same connector name, so a
// freshly built connector replaces its placeholder instead of sitting beside it.
function removeComingSoonEntryByName(text: string, name: string): string {
  return text.replace(
    new RegExp(`\\n\\s*\\{[^\\n]*name:\\s*'${escapeRegExp(name)}'[^\\n]*available:\\s*false[^\\n]*\\},`, 'g'),
    '',
  )
}

// Write a Simulate-mode data block into lib/simulate-action.ts so the connector
// demos with realistic fake responses instead of the generic stub. Idempotent
// (skips if the slug is already present) and best-effort — a failure here never
// blocks the apply (the connector still works; the parity test flags the gap).
function writeSimulatedData(root: string, slug: string, simData: Record<string, unknown> | null | undefined): string | null {
  if (!simData || Object.keys(simData).length === 0) return null
  try {
    const simPath = join(root, 'lib', 'simulate-action.ts')
    const src = readFileSync(simPath, 'utf-8')
    if (src.includes(`'${slug}': {`)) return null // already registered
    const anchor = 'const DATA: Record<string, Record<string, SimFn>> = {\n'
    const at = src.indexOf(anchor)
    if (at === -1) return null
    const entries = Object.entries(simData)
      .map(([action, data]) => `    '${action}': () => ({ ok: true, data: ${JSON.stringify(data)} }),`)
      .join('\n')
    const block = `  '${slug}': {\n${entries}\n  },\n\n`
    const pos = at + anchor.length
    writeFileSync(simPath, src.slice(0, pos) + block + src.slice(pos), 'utf-8')
    return 'lib/simulate-action.ts'
  } catch {
    return null
  }
}

/**
 * Seed/refresh the `connectors` DB row for a connector. Required for the
 * connector to be connectable — /api/connections resolves connectors.id for the
 * connection FK. Called by every apply path (auto-apply on approve + manual apply).
 */
export async function registerConnectorRow(admin: SupabaseClient, meta: ApplyResult['meta']) {
  return admin.from('connectors').upsert(
    {
      slug: meta.slug,
      name: meta.name,
      category: meta.category,
      manifest: { description: meta.description },
      is_simulated: false,
    },
    { onConflict: 'slug' },
  )
}

export function applyConnectorBuild(input: ApplyInput): ApplyResult {
  const { slug, connectorName, manifestCode, catalogEntryStr, importLine, exportEntry, logoSvg, simulatedData } = input
  const root = process.cwd()
  const written: string[] = []

  // 1. Write connector TypeScript file
  const connectorDir = join(root, 'connectors', slug)
  if (!existsSync(connectorDir)) mkdirSync(connectorDir, { recursive: true })
  const connectorFile = join(connectorDir, 'index.ts')
  writeFileSync(connectorFile, manifestCode, 'utf-8')
  written.push(`connectors/${slug}/index.ts`)

  // 2. Write SVG logo
  if (logoSvg) {
    const logoPath = join(root, 'public', 'logos', `${slug}.svg`)
    writeFileSync(logoPath, logoSvg, 'utf-8')
    written.push(`public/logos/${slug}.svg`)
  }

  // 3. Parse catalog entry fields
  const parsed = parseCatalogEntry(catalogEntryStr)
  const name = (parsed?.name as string | undefined) ?? connectorName
  const category = (parsed?.category as string | undefined) ?? 'Productivity'
  const rawDescription = (parsed?.description as string | undefined) ?? `${connectorName} integration.`
  const description = rawDescription.replace(/'/g, "\\'")

  // 4. Update connectors/catalog.ts — de-duplicate so we never end up with two
  //    cards for the same connector (e.g. a "coming soon" placeholder alongside
  //    the freshly built one). Remove any existing entry with this slug and any
  //    coming-soon entry with this name, then add one fresh "available" entry.
  const catalogPath = join(root, 'connectors', 'catalog.ts')
  const original = readFileSync(catalogPath, 'utf-8')
  const nameEsc = name.replace(/'/g, "\\'")
  let cat = removeCatalogEntryBySlug(original, slug)
  cat = removeComingSoonEntryByName(cat, name)
  const newEntry = `\n  { slug: '${slug}', name: '${nameEsc}', category: '${category}', description: '${description}', logoUrl: '/logos/${slug}.svg', available: true, badgeNew: true  },`
  // Insert right before the closing ] of the catalog array
  const insertAt = cat.lastIndexOf('\n]\n\nexport const AVAILABLE_SLUGS')
  if (insertAt !== -1) {
    cat = cat.slice(0, insertAt) + newEntry + cat.slice(insertAt)
  } else {
    const fallback = cat.lastIndexOf('\n]')
    cat = cat.slice(0, fallback) + newEntry + cat.slice(fallback)
  }
  if (cat !== original) {
    writeFileSync(catalogPath, cat, 'utf-8')
    written.push('connectors/catalog.ts')
  }

  // 5. Update connectors/index.ts — skip if import already present
  const indexPath = join(root, 'connectors', 'index.ts')
  let idx = readFileSync(indexPath, 'utf-8')
  if (!idx.includes(`from './${slug}'`)) {
    // Add import before "export const connectors"
    idx = idx.replace('\nexport const connectors', `\n${importLine}\n\nexport const connectors`)
    // Add to array before simulatedLightsManifest (keep simulated entries last)
    if (idx.includes('\n  simulatedLightsManifest,')) {
      idx = idx.replace('\n  simulatedLightsManifest,', `\n  ${exportEntry},\n  simulatedLightsManifest,`)
    } else {
      // Fallback: append before closing ]
      idx = idx.replace('\n]', `\n  ${exportEntry},\n]`)
    }
    writeFileSync(indexPath, idx, 'utf-8')
    written.push('connectors/index.ts')
  }

  // 6. Write Simulate-mode sample data (best-effort; never blocks the apply)
  const simFile = writeSimulatedData(root, slug, simulatedData)
  if (simFile) written.push(simFile)

  return { ok: true, filesWritten: written, meta: { slug, name, category, description: rawDescription } }
}

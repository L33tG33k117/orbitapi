import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface ApplyInput {
  slug: string
  connectorName: string
  manifestCode: string
  catalogEntryStr: string // JS object literal from AI
  importLine: string
  exportEntry: string
  logoSvg: string | null
}

export interface ApplyResult {
  ok: boolean
  error?: string
  filesWritten: string[]
}

// eslint-disable-next-line no-new-func
function parseCatalogEntry(str: string): Record<string, unknown> | null {
  try {
    return new Function(`return (${str})`)() as Record<string, unknown>
  } catch {
    return null
  }
}

export function applyConnectorBuild(input: ApplyInput): ApplyResult {
  const { slug, connectorName, manifestCode, catalogEntryStr, importLine, exportEntry, logoSvg } = input
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
  const description = ((parsed?.description as string | undefined) ?? `${connectorName} integration.`).replace(/'/g, "\\'")

  // 4. Update connectors/catalog.ts — skip if slug already registered
  const catalogPath = join(root, 'connectors', 'catalog.ts')
  let cat = readFileSync(catalogPath, 'utf-8')
  if (!cat.includes(`slug: '${slug}'`)) {
    const newEntry = `\n  { slug: '${slug}', name: '${name}', category: '${category}', description: '${description}', logoUrl: '/logos/${slug}.svg', available: true, badgeNew: true  },`
    // Insert right before the closing ] of the catalog array
    const insertAt = cat.lastIndexOf('\n]\n\nexport const AVAILABLE_SLUGS')
    if (insertAt !== -1) {
      cat = cat.slice(0, insertAt) + newEntry + cat.slice(insertAt)
    } else {
      const fallback = cat.lastIndexOf('\n]')
      cat = cat.slice(0, fallback) + newEntry + cat.slice(fallback)
    }
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

  return { ok: true, filesWritten: written }
}

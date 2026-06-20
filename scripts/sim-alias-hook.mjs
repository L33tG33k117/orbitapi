/**
 * ESM resolve hook so plain `node` can import the project's TypeScript modules
 * (which use the `@/` path alias and extensionless relative imports) without a
 * bundler. Node 23.6+/24 strips types natively; this only fixes resolution.
 *
 * Used by scripts/test-sim-parity.mjs via module.register().
 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const root = process.cwd().replace(/\\/g, '/')

function withExt(url) {
  if (/\.(ts|tsx|mjs|js|json)$/.test(url)) return url
  const p = fileURLToPath(url)
  for (const cand of [`${p}.ts`, `${p}.tsx`, `${p}/index.ts`]) {
    if (existsSync(cand)) return pathToFileURL(cand).href
  }
  return url
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    return next(withExt(pathToFileURL(`${root}/${specifier.slice(2)}`).href), context)
  }
  if (specifier.startsWith('.')) {
    const base = context.parentURL ?? pathToFileURL(`${root}/`).href
    return next(withExt(new URL(specifier, base).href), context)
  }
  return next(specifier, context)
}

// Resolver hook implementation — see ts-resolve-hook.mjs.

import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../..')

function firstExisting(base) {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  // `@/lib/foo` → <root>/lib/foo.ts
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(path.join(projectRoot, specifier.slice(2)))
    if (hit) return { url: hit, shortCircuit: true }
  }

  // `./usage-cost` → ./usage-cost.ts, relative to the importing file
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    const hit = firstExisting(base)
    if (hit) return { url: hit, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}

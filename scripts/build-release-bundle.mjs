#!/usr/bin/env node
/**
 * Build a self-hosted release bundle.
 *
 *   node scripts/build-release-bundle.mjs --version 1.2.3 \
 *     [--sign ./release-k1.private.pem --kid r1] [--out ./dist]
 *
 * The bundle is what an air-gapped customer receives — over a USB stick, a
 * share, an email. There is no TLS connection vouching for it, so it has to
 * vouch for itself: every file is checksummed, and the manifest is signed.
 *
 * `--sign` is optional so CI can build an unsigned bundle for its own tests,
 * but verify-bundle.mjs REFUSES unsigned bundles unless explicitly overridden,
 * so an unsigned one can never be applied by a customer.
 *
 * Contents:
 *   manifest.json     version, image list, checksums
 *   manifest.sig      Ed25519 over manifest.json (when --sign is given)
 *   images/*.tar      docker save of every image the stack runs
 *   migrations/       ALL migrations, not a delta — the runner skips applied
 *                     ones, so a customer can jump several versions at once
 *                     without us maintaining upgrade chains
 *   changelog.md      what changed, rendered for a human
 */
import { execFileSync } from 'node:child_process'
import { createHash, sign as signBuffer, createPrivateKey } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1) }

const version = arg('version')
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  fail('Usage: build-release-bundle.mjs --version <semver> [--sign <key.pem> --kid <id>] [--out <dir>]')
}

const signKeyPath = arg('sign')
const kid = arg('kid', 'r1')
const outDir = arg('out', join(ROOT, 'dist'))
const stage = join(outDir, `orbit-selfhost-${version}`)

// Images the stack runs. The app one is built from this repo; the rest are
// pinned upstream images pulled at build time, so an offline install never has
// to reach a registry.
const IMAGES = [
  { name: 'orbit-app', ref: `orbitapi/app:${version}` },
  { name: 'postgres', ref: 'postgres:16-alpine' },
  { name: 'gotrue', ref: 'supabase/gotrue:v2.177.0' },
  { name: 'postgrest', ref: 'postgrest/postgrest:v12.2.3' },
  { name: 'nginx', ref: 'nginx:1.27-alpine' },
]

console.log(`\nBuilding orbit-selfhost-${version}\n`)

rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, 'images'), { recursive: true })

// ---- images ----------------------------------------------------------------
console.log('Saving images (this is the slow part)…')
for (const img of IMAGES) {
  const tar = join(stage, 'images', `${img.name}.tar`)
  process.stdout.write(`  → ${img.ref} `)
  try {
    execFileSync('docker', ['save', '-o', tar, img.ref], { stdio: 'pipe' })
  } catch {
    fail(`could not save ${img.ref}. Build or pull it first:\n    docker pull ${img.ref}`)
  }
  console.log(`(${(statSync(tar).size / 1e6).toFixed(0)} MB)`)
}

// ---- migrations ------------------------------------------------------------
// ALL of them, deliberately. The runner tracks what's applied and skips those,
// so a customer three versions behind upgrades in one step. Shipping deltas
// would mean maintaining minFromVersion chains for every release pair.
cpSync(join(ROOT, 'supabase', 'migrations'), join(stage, 'migrations'), { recursive: true })
const migrationCount = readdirSync(join(stage, 'migrations')).filter(f => f.endsWith('.sql')).length
console.log(`\nIncluded ${migrationCount} migrations`)

// ---- changelog -------------------------------------------------------------
let changelog = `# OrbitAPI ${version}\n\n`
try {
  const src = readFileSync(join(ROOT, 'app', 'changelog', 'changelog-data.ts'), 'utf8')
  const entries = [...src.matchAll(/title:\s*'([^']+)'[\s\S]{0,400}?body:\s*'([^']*)'/g)].slice(0, 12)
  changelog += entries.map(([, title, body]) => `## ${title}\n\n${body}\n`).join('\n')
} catch {
  changelog += '_See the changelog on orbitapi.com for details._\n'
}
writeFileSync(join(stage, 'changelog.md'), changelog)

// ---- manifest --------------------------------------------------------------
function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const files = []
function addDir(rel) {
  const abs = join(stage, rel)
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`
    if (entry.isDirectory()) addDir(childRel)
    else files.push({ path: childRel, sha256: sha256(join(stage, childRel)), bytes: statSync(join(stage, childRel)).size })
  }
}
addDir('images')
addDir('migrations')
files.push({ path: 'changelog.md', sha256: sha256(join(stage, 'changelog.md')), bytes: statSync(join(stage, 'changelog.md')).size })

const manifest = {
  product: 'orbitapi',
  version,
  builtAt: new Date().toISOString(),
  images: IMAGES.map(i => ({ name: i.name, ref: i.ref, tar: `images/${i.name}.tar` })),
  migrations: migrationCount,
  files,
  ...(signKeyPath ? { kid } : {}),
}
const manifestJson = JSON.stringify(manifest, null, 2)
writeFileSync(join(stage, 'manifest.json'), manifestJson)

// ---- signature -------------------------------------------------------------
if (signKeyPath) {
  if (!existsSync(signKeyPath)) fail(`No signing key at ${signKeyPath}`)
  // Signed over the manifest bytes, and the manifest covers every file's
  // checksum — so one signature protects the whole bundle.
  const sig = signBuffer(null, Buffer.from(manifestJson), createPrivateKey(readFileSync(signKeyPath)))
  writeFileSync(join(stage, 'manifest.sig'), sig)
  console.log(`Signed with key "${kid}"`)
} else {
  console.log('! UNSIGNED — for local testing only; customers cannot apply this.')
}

// ---- archive ---------------------------------------------------------------
const archive = `orbit-selfhost-${version}.tar.gz`
execFileSync('tar', ['-czf', archive, '-C', `orbit-selfhost-${version}`, '.'], { cwd: outDir, stdio: 'pipe' })
rmSync(stage, { recursive: true, force: true })

const size = statSync(join(outDir, archive)).size
console.log(`\n✓ ${join(outDir, archive)}  (${(size / 1e6).toFixed(0)} MB)\n`)

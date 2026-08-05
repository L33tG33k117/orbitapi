#!/usr/bin/env node
/**
 * Verify a self-hosted update bundle before anything is applied.
 *
 *   node scripts/verify-bundle.mjs <bundle.tar.gz>
 *
 * An air-gapped customer receives updates as a file — over a USB stick, a
 * share, an email attachment. There is no TLS connection to us vouching for
 * it, so the bundle has to vouch for itself. Exits non-zero on any problem;
 * orbit.sh refuses to apply the update in that case.
 *
 * Checks, in order of how cheaply they fail:
 *   1. structure   — manifest.json present and well-formed
 *   2. contents    — every file it lists actually exists
 *   3. integrity   — sha256 of each file matches the manifest
 *   4. authenticity— Ed25519 signature over the manifest (Phase 3; a bundle
 *                    without one is reported as UNSIGNED, and refused unless
 *                    --allow-unsigned is passed for local testing)
 */
import { createHash, verify as cryptoVerify, createPublicKey } from 'node:crypto'
import { existsSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const bundlePath = process.argv[2]
const allowUnsigned = process.argv.includes('--allow-unsigned')

function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1) }
function ok(msg) { console.log(`  ✓ ${msg}`) }

if (!bundlePath) fail('Usage: node scripts/verify-bundle.mjs <bundle.tar.gz> [--allow-unsigned]')
if (!existsSync(bundlePath)) fail(`No such file: ${bundlePath}`)

// Release signing keys. The private half never leaves the founder's password
// manager; rotation works by adding a new entry and selecting it with `kid`.
const RELEASE_PUBLIC_KEYS = {
  // 'r1': '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n',
}

const work = mkdtempSync(join(tmpdir(), 'orbit-verify-'))

try {
  console.log(`\nVerifying ${bundlePath}\n`)

  try {
    execFileSync('tar', ['-xzf', bundlePath, '-C', work], { stdio: 'pipe' })
  } catch {
    fail('Could not extract the archive — it may be truncated or not a .tar.gz.')
  }
  ok('archive extracts')

  // ---- 1. structure --------------------------------------------------------
  const manifestPath = join(work, 'manifest.json')
  if (!existsSync(manifestPath)) fail('manifest.json is missing — this is not an OrbitAPI update bundle.')

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    fail('manifest.json is not valid JSON.')
  }

  for (const field of ['version', 'files']) {
    if (!manifest[field]) fail(`manifest.json is missing "${field}".`)
  }
  if (!Array.isArray(manifest.files)) fail('manifest.json "files" must be a list.')
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    fail(`manifest version "${manifest.version}" is not a semantic version.`)
  }
  ok(`manifest is well-formed (version ${manifest.version})`)

  // ---- 2 + 3. contents and integrity --------------------------------------
  let totalBytes = 0
  for (const entry of manifest.files) {
    if (!entry.path || !entry.sha256) fail('every entry in "files" needs a path and a sha256.')

    // A manifest is untrusted input until it's verified, so a path in it must
    // not be able to reach outside the extracted directory.
    if (entry.path.includes('..') || entry.path.startsWith('/')) {
      fail(`manifest lists an unsafe path: ${entry.path}`)
    }

    const full = join(work, entry.path)
    if (!existsSync(full)) fail(`manifest lists ${entry.path}, but it is not in the bundle.`)

    const bytes = readFileSync(full)
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== entry.sha256) {
      fail(`${entry.path} does not match its checksum — the bundle is corrupt or was modified.`)
    }
    totalBytes += statSync(full).size
  }
  ok(`${manifest.files.length} file(s) match their checksums (${(totalBytes / 1e6).toFixed(1)} MB)`)

  // ---- 4. authenticity -----------------------------------------------------
  const sigPath = join(work, 'manifest.sig')
  if (!existsSync(sigPath)) {
    if (!allowUnsigned) {
      fail('This bundle is UNSIGNED. Only apply bundles downloaded from your OrbitAPI account.\n' +
           '  (Pass --allow-unsigned only when testing a bundle you built yourself.)')
    }
    console.log('  ! UNSIGNED — allowed because --allow-unsigned was passed')
  } else {
    const kid = manifest.kid
    const pem = kid ? RELEASE_PUBLIC_KEYS[kid] : undefined
    if (!pem) {
      fail(`This bundle is signed with an unknown key ("${kid ?? 'none'}"). ` +
           'Your installation may be too old to verify it — update in steps, or contact support.')
    }
    const good = cryptoVerify(
      null,
      readFileSync(manifestPath),
      createPublicKey(pem),
      readFileSync(sigPath),
    )
    if (!good) fail('Signature does not match. Do not apply this bundle.')
    ok(`signature valid (key ${kid})`)
  }

  console.log(`\n✓ Bundle ${manifest.version} verified\n`)
} finally {
  rmSync(work, { recursive: true, force: true })
}

// Verification for versioning and release bundles (offline edition, Phase 3b).
//
// The bundle is the only thing standing between a customer's server and
// whatever file happens to be sitting in their updates folder. So the checks
// here are mostly about REFUSAL: a bundle that shouldn't apply must not.
//
// Run: npm run test:release

import { execFileSync } from 'node:child_process'
import { createHash, generateKeyPairSync, sign as signBuffer } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

const { getVersion, compareVersions, isUpgrade } = await import('../lib/version.ts')

console.log('\nVersion detection')
{
  // getVersion() reads several ambient variables, and CI sets GITHUB_SHA for
  // us — so each case has to clear ALL of them, not just the one it sets.
  const before = {
    v: process.env.ORBIT_VERSION,
    vercel: process.env.VERCEL_GIT_COMMIT_SHA,
    gh: process.env.GITHUB_SHA,
  }
  const clearAll = () => {
    delete process.env.ORBIT_VERSION
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
  }

  clearAll()
  process.env.ORBIT_VERSION = '1.2.3'
  const released = getVersion()
  check('a semver build arg is a release', released.version === '1.2.3' && released.released)

  clearAll()
  process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890'
  const rolling = getVersion()
  check('a commit SHA is not a release', rolling.version === 'abcdef1' && !rolling.released)

  clearAll()
  process.env.GITHUB_SHA = 'fedcba9876543210'
  const ghBuild = getVersion()
  check('a GitHub SHA is also not a release', ghBuild.version === 'fedcba9' && !ghBuild.released)

  clearAll()
  check('with nothing set it reports dev', getVersion().version === 'dev')

  clearAll()
  if (before.v) process.env.ORBIT_VERSION = before.v
  if (before.vercel) process.env.VERCEL_GIT_COMMIT_SHA = before.vercel
  if (before.gh) process.env.GITHUB_SHA = before.gh
}

console.log('\nVersion comparison')
check('1.2.3 < 1.2.4', compareVersions('1.2.3', '1.2.4') === -1)
check('1.10.0 > 1.9.9 (numeric, not lexical)', compareVersions('1.10.0', '1.9.9') === 1)
check('2.0.0 > 1.99.99', compareVersions('2.0.0', '1.99.99') === 1)
check('equal versions compare equal', compareVersions('1.2.3', '1.2.3') === 0)
check('pre-release suffixes are ignored', compareVersions('1.2.3-rc1', '1.2.3') === 0)

console.log('\nUpgrade detection')
check('a newer version is an upgrade', isUpgrade('1.2.3', '1.3.0'))
// The one that protects a customer from moving backwards by accident.
check('an older version is NOT an upgrade', !isUpgrade('1.3.0', '1.2.3'))
check('the same version is NOT an upgrade', !isUpgrade('1.2.3', '1.2.3'))
check('anything tagged upgrades a dev build', isUpgrade('dev', '1.0.0'))
check('anything tagged upgrades a SHA build', isUpgrade('abc1234', '1.0.0'))

console.log('\nBundle verification')
const work = mkdtempSync(join(tmpdir(), 'orbit-release-'))
try {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const { privateKey: otherPriv } = generateKeyPairSync('ed25519')
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

  // Register a test key by patching the verifier's key map for this run only.
  const verifierSrc = readFileSync(join(ROOT, 'scripts', 'verify-bundle.mjs'), 'utf8')
  const patched = verifierSrc.replace(
    'const RELEASE_PUBLIC_KEYS = {',
    `const RELEASE_PUBLIC_KEYS = {\n  't1': ${JSON.stringify(pubPem)},`,
  )
  const verifier = join(work, 'verify.mjs')
  writeFileSync(verifier, patched)
  check('the verifier has a key map to register into', patched !== verifierSrc)

  function build(name, { sign = privateKey, kid = 't1', corrupt = false, tamperManifest = false } = {}) {
    const dir = join(work, name)
    mkdirSync(join(dir, 'images'), { recursive: true })
    const payload = Buffer.from(`image bytes for ${name}`)
    writeFileSync(join(dir, 'images', 'app.tar'), payload)

    const manifest = {
      product: 'orbitapi',
      version: '1.2.3',
      files: [{
        path: 'images/app.tar',
        sha256: corrupt
          ? createHash('sha256').update('different').digest('hex')
          : createHash('sha256').update(payload).digest('hex'),
      }],
      ...(sign ? { kid } : {}),
    }
    let json = JSON.stringify(manifest, null, 2)
    writeFileSync(join(dir, 'manifest.json'), json)

    if (sign) {
      const sig = signBuffer(null, Buffer.from(json), sign)
      writeFileSync(join(dir, 'manifest.sig'), sig)
      if (tamperManifest) {
        // Signature stays valid for the ORIGINAL manifest; the manifest is
        // then swapped. This is the realistic attack.
        const evil = JSON.stringify({ ...manifest, version: '9.9.9' }, null, 2)
        writeFileSync(join(dir, 'manifest.json'), evil)
      }
    }

    execFileSync('tar', ['-czf', `${name}.tar.gz`, '-C', name, '.'], { cwd: work, stdio: 'pipe' })
    return `${name}.tar.gz`
  }

  function verify(bundle, extra = []) {
    try {
      execFileSync(process.execPath, [verifier, bundle, ...extra], { cwd: work, stdio: 'pipe' })
      return true
    } catch { return false }
  }

  check('a correctly signed bundle passes', verify(build('good')))
  check('an unsigned bundle is refused by default', !verify(build('unsigned', { sign: null })))
  check('an unsigned bundle passes only with the explicit override',
    verify(build('unsigned2', { sign: null }), ['--allow-unsigned']))
  check('a bundle signed with the wrong key is refused',
    !verify(build('wrongkey', { sign: otherPriv })))
  check('a bundle with an unknown kid is refused',
    !verify(build('unknownkid', { kid: 'nope' })))
  check('a corrupted payload is refused', !verify(build('corrupt', { corrupt: true })))
  // The attack the signature exists to stop.
  check('a swapped manifest with a valid old signature is refused',
    !verify(build('tampered', { tamperManifest: true })))
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log('\nRelease tooling is wired')
{
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8')
  check('release runs on a selfhost tag', wf.includes("tags: ['selfhost-v*']"))
  check('release verifies before building', /npm run test:offline/.test(wf))
  check('release verifies the bundle it produced', /verify-bundle\.mjs/.test(wf))
  check('the signing key is shredded afterwards', /rm -f \/tmp\/release\.pem/.test(wf))
  check('an unsigned release warns loudly', /Unsigned release/.test(wf))

  const builder = readFileSync(join(ROOT, 'scripts', 'build-release-bundle.mjs'), 'utf8')
  // Shipping every migration is what lets a customer skip several versions.
  check('the bundle ships ALL migrations, not a delta', /supabase', 'migrations'/.test(builder))
  check('the bundle pins the same images compose runs',
    builder.includes('supabase/gotrue:v2.177.0') && builder.includes('postgrest/postgrest:v12.2.3'))

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  check('package.json is no longer named orbit-temp', pkg.name === 'orbitapi')
  check('package.json carries a real version', /^\d+\.\d+\.\d+$/.test(pkg.version))

  const updatesApi = readFileSync(join(ROOT, 'app', 'api', 'admin', 'updates', 'route.ts'), 'utf8')
  // The app must never gain the ability to restart its own host.
  check('the updates API only verifies, never applies', !/docker|compose|exec\(.*orbit\.sh/.test(updatesApi.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')))
  check('the updates API hands back a command for a human', /orbit\.sh update/.test(updatesApi))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1

import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createClient } from '@/lib/supabase/server'
import { isSelfHost } from '@/lib/edition'
import { getVersion, isUpgrade } from '@/lib/version'

const exec = promisify(execFile)

// ============================================================
// Offline updates
// ============================================================
// The app can SEE update bundles and VERIFY them, but it does not apply them.
// Applying one means loading images and restarting containers, which needs
// access to the Docker socket — root-equivalent on the host. Mounting that
// into a web-facing container would mean any remote-code-execution bug in the
// app became full control of the machine.
//
// So the split is: this screen verifies the bundle and shows the exact command
// to run, and a human runs it on the host. Same shape GitLab and Mattermost
// use, and it survives a security review.
// ============================================================

const UPDATES_DIR = '/app/updates'

export async function GET() {
  if (!isSelfHost()) return NextResponse.json({ error: 'Not available.' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const current = getVersion()

  // What the last check-in heard, if this install talks to us at all. Turns
  // this page from "look in a folder" into "1.3.0 is out". Absent for an
  // air-gapped install, and absent before migration 057 — in both cases the
  // page behaves exactly as it did before.
  let available: string | null = null
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await createAdminClient()
      .from('instance_settings')
      .select('latest_version')
      .eq('id', 1)
      .maybeSingle()
    const latest = data?.latest_version ?? null
    if (latest && isUpgrade(current.version, latest)) available = latest
  } catch { /* pre-057, or offline: no announcement to make */ }

  if (!existsSync(UPDATES_DIR)) {
    return NextResponse.json({ current: current.version, bundles: [], updatesDir: UPDATES_DIR, available })
  }

  const candidates = readdirSync(UPDATES_DIR).filter(f => f.endsWith('.tar.gz'))

  const bundles = await Promise.all(candidates.map(async (file) => {
    const path = join(UPDATES_DIR, file)
    const sizeMb = Math.round(statSync(path).size / 1e6)

    // Verified here, not merely listed. An admin should never be shown a
    // "ready to install" bundle that then fails on the host, and should never
    // be handed a command for a bundle we know is bad.
    try {
      const { stdout } = await exec(process.execPath, [
        join(process.cwd(), 'scripts', 'verify-bundle.mjs'), path,
      ], { timeout: 120_000 })

      const version = stdout.match(/version ([\d.]+)/)?.[1] ?? null
      return {
        file, sizeMb, version,
        verified: true,
        isUpgrade: version ? isUpgrade(current.version, version) : false,
        command: `sudo ./orbit.sh update updates/${file}`,
      }
    } catch (err) {
      const message = String((err as { stderr?: string })?.stderr ?? err).slice(0, 400)
      return { file, sizeMb, version: null, verified: false, isUpgrade: false, error: message }
    }
  }))

  return NextResponse.json({
    current: current.version,
    released: current.released,
    available,
    updatesDir: UPDATES_DIR,
    bundles: bundles.sort((a, b) => (b.version ?? '').localeCompare(a.version ?? '')),
  })
}

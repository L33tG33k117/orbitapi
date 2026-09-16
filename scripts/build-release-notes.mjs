#!/usr/bin/env node
/**
 * Turns git history into the structured feed behind Admin -> Releases.
 *
 * WHY THIS IS GENERATED: the curated customer changelog kept going stale,
 * because keeping it current depended on somebody remembering. This half does
 * not: it reads what actually landed on main, so the admin view can never
 * silently fall behind what is deployed. The customer-facing notes stay
 * hand-written (lib/release-notes/customer.ts) — a commit subject is not
 * release copy — and the admin view flags when they lag.
 *
 * Runs over --first-parent, so one entry = one thing that landed on main
 * (a merge, or a direct commit), never the individual commits inside a branch.
 *
 * Output is committed to the repo because Vercel builds from a shallow clone
 * and has no history to read at runtime.
 *
 *   npm run notes:build
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'data', 'release-notes.json')
const SINCE = process.env.NOTES_SINCE || '2026-06-01'
const SEP = '<<<ORBIT>>>'

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// ── What kind of change is this? ────────────────────────────────────────────
// Ordered: the first match wins, so security beats a generic "fix".
// The workflow below commits the regenerated feed back to main. Those commits
// are bookkeeping about this file, not product changes, so they never appear
// in the feed — otherwise every release would be trailed by a note saying a
// note was written.
const BOT_SUBJECT = /^chore: regenerate release notes/i

const CATEGORIES = [
  { id: 'security',   label: 'Security',       re: /\b(security|vulnerab|advisor|CVE|RCE|exploit|isolat|auth bypass|injection|leak|credential|secret)\b/i },
  { id: 'fix',        label: 'Fix',            re: /\b(fix|fixes|fixed|bug|regression|broke|broken|repair|correct)\b/i },
  { id: 'feature',    label: 'New',            re: /\b(add|adds|added|new|introduce|ship|build|create|support for)\b/i },
  { id: 'perf',       label: 'Performance',    re: /\b(perf|performance|faster|speed|optimi[sz]|timeout|cache)\b/i },
  { id: 'infra',      label: 'Infrastructure', re: /\b(ci|workflow|deploy|migrat|upgrade|bump|depend|refactor|test|chore)\b/i },
]

// Which part of the product a path belongs to. First match wins.
const AREAS = [
  { re: /^supabase\/migrations\//,      label: 'Database migration' },
  { re: /^connectors\//,                label: 'Connectors' },
  { re: /^app\/api\//,                  label: 'API' },
  { re: /^app\/admin\//,                label: 'Admin' },
  { re: /^(package\.json|package-lock\.json|tsconfig|next\.config|eslint)/, label: 'Dependencies' },
  // A dashboard SECTION (a directory), not a file sitting at the dashboard root.
  { re: /^app\/\(dashboard\)\/([^/]+)\//, label: null },
  { re: /^app\/\(dashboard\)\//,          label: 'App shell' },
  { re: /^app\/\(auth\)\//,             label: 'Sign-in' },
  { re: /^app\/(changelog|integrations|solutions|demo|how-it-works)/, label: 'Marketing site' },
  { re: /^components\//,                label: 'UI components' },
  { re: /^lib\//,                       label: 'Core logic' },
  { re: /^scripts\//,                   label: 'Tooling' },
  { re: /^\.github\//,                  label: 'CI' },
  { re: /^docker\//,                    label: 'Self-hosted' },
  { re: /^docs\//,                      label: 'Docs' },
]

const AREA_NAMES = { 'ai power': 'AI Power', 'mcp': 'MCP', 'data mapping': 'Data mapping', 'ai provider': 'AI provider' }

function areaOf(path) {
  for (const a of AREAS) {
    const m = path.match(a.re)
    if (!m) continue
    if (a.label) return a.label
    // Dashboard section: "playbooks" -> "Playbooks"
    const name = m[1].replace(/[-_]/g, ' ')
    return AREA_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
  }
  return 'Other'
}

function categorise(subject, body, files) {
  const text = `${subject}\n${body}`
  if (files.some(f => f.path.startsWith('supabase/migrations/'))) {
    // A migration is worth surfacing regardless of wording, but don't let it
    // outrank an explicit security change.
    const sec = CATEGORIES[0].re.test(text)
    if (sec) return CATEGORIES[0]
  }
  for (const c of CATEGORIES) if (c.re.test(text)) return c
  return { id: 'other', label: 'Change' }
}

// ── Read history ────────────────────────────────────────────────────────────
const raw = git(['log', '--first-parent', `--since=${SINCE}`, `--format=${SEP}%H%n%h%n%aI%n%an%n%s%n%b`])
const blocks = raw.split(SEP).map(b => b.trim()).filter(Boolean)

const entries = []
for (const block of blocks) {
  const lines = block.split('\n')
  const [sha, short, date, author, subject] = lines
  const body = lines.slice(5).join('\n').trim()

  if (BOT_SUBJECT.test(subject)) continue

  // --numstat gives added/removed per file. Merges need -m --first-parent to
  // show the change the merge actually brought onto main.
  let stat = ''
  try {
    stat = git(['show', '--numstat', '--format=', '-m', '--first-parent', sha])
  } catch { stat = '' }

  const files = []
  for (const line of stat.split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m) continue
    const path = m[3]
    if (files.some(f => f.path === path)) continue
    files.push({
      path,
      added: m[1] === '-' ? 0 : Number(m[1]),
      removed: m[2] === '-' ? 0 : Number(m[2]),
      binary: m[1] === '-',
    })
  }

  const areas = [...new Set(files.map(f => areaOf(f.path)))].sort()
  const migrations = files
    .filter(f => /^supabase\/migrations\/.+\.sql$/.test(f.path) && f.added > 0)
    .map(f => f.path.split('/').pop())

  const cat = categorise(subject, body, files)

  // The body of these commits is written as prose paragraphs. Keep them as
  // paragraphs — an admin reading "why" needs the sentences, not a bullet.
  const paragraphs = body
    .split(/\n\s*\n/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p && !/^Co-Authored-By:/i.test(p))

  entries.push({
    sha, short, date, author, subject,
    category: cat.id,
    categoryLabel: cat.label,
    paragraphs,
    areas,
    migrations,
    files: files.length,
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0),
    // Only the paths, capped — enough for an admin to see the blast radius
    // without turning the page into a diff viewer.
    topPaths: files
      .slice()
      .sort((a, b) => (b.added + b.removed) - (a.added + a.removed))
      .slice(0, 12)
      .map(f => f.path),
  })
}

mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  generatedFrom: entries[0]?.sha ?? null,
  since: SINCE,
  entries,
}, null, 2) + '\n')

console.log(`\n✓ ${entries.length} release entries written to data/release-notes.json`)
console.log(`  newest: ${entries[0]?.short} ${entries[0]?.subject ?? '(none)'}\n`)

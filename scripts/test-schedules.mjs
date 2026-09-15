// Schedules with time zones + severity bands.
//
// Run: npm run test:schedules

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const S = await import(pathToFileURL(join(ROOT, 'lib/schedules.ts')).href)
const V = await import(pathToFileURL(join(ROOT, 'lib/severity.ts')).href)

let passed = 0, failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}
const at = iso => new Date(iso)

console.log('Schedules')
// Legacy strings stay UTC
check('legacy "*:8" parses as UTC', S.parseSchedule('*:8').tz === 'UTC')
check('legacy "*:8" due at 08:00Z', S.isDue('*:8', at('2026-03-10T08:00:00Z')))
check('legacy "*:8" not due at 09:00Z', !S.isDue('*:8', at('2026-03-10T09:00:00Z')))
// Round trip
check('UTC is stored bare', S.buildSchedule('1', '14', 'UTC') === '1:14')
check('zone is stored after @', S.buildSchedule('1', '14', 'America/New_York') === '1:14@America/New_York')
check('invalid zone is dropped', S.buildSchedule('1', '14', 'Mars/Olympus') === '1:14')
check('invalid stored zone reads as UTC', S.parseSchedule('*:8@Nope/Nope').tz === 'UTC')
// New York: EST (UTC-5) in January, EDT (UTC-4) in July
check('8am New York in winter = 13:00Z', S.isDue('*:8@America/New_York', at('2026-01-15T13:00:00Z')))
check('8am New York in summer = 12:00Z', S.isDue('*:8@America/New_York', at('2026-07-15T12:00:00Z')))
check('8am New York is not 08:00Z', !S.isDue('*:8@America/New_York', at('2026-07-15T08:00:00Z')))
// Day of week is evaluated in the zone: Monday 9pm LA = Tuesday 04:00Z
check('Mondays 9pm LA fires Tue 04:00Z', S.isDue('1:21@America/Los_Angeles', at('2026-07-14T04:00:00Z')))
check('Tuesdays 9pm LA does not fire then', !S.isDue('2:21@America/Los_Angeles', at('2026-07-14T04:00:00Z')))
// Positive offset crossing midnight: Tokyo Monday 07:00 = Sunday 22:00Z
check('Mondays 7am Tokyo fires Sun 22:00Z', S.isDue('1:7@Asia/Tokyo', at('2026-07-12T22:00:00Z')))
// Half-hour zone: 9am Kolkata (UTC+5:30) = 03:30Z; hourly tick at 03:00Z is 08:30 local
check('Kolkata 8am matches the 03:00Z tick', S.isDue('*:8@Asia/Kolkata', at('2026-07-12T03:00:00Z')))
// DST spring-forward (2026-03-08, NY): 2am does not exist
const springNY = ['06', '07', '08'].map(h => at(`2026-03-08T${h}:00:00Z`))
check('2am NY on spring-forward day never fires', !springNY.some(d => S.isDue('*:2@America/New_York', d)))
// DST fall-back (2026-11-01, NY): 1am happens twice (05:00Z and 06:00Z)
check('1am NY on fall-back matches twice (dedupe window handles it)',
  S.isDue('*:1@America/New_York', at('2026-11-01T05:00:00Z')) && S.isDue('*:1@America/New_York', at('2026-11-01T06:00:00Z')))
// Daily-only host
check('ignoreHour fires on the right day', S.isDue('2:8@America/New_York', at('2026-07-14T14:00:00Z'), { ignoreHour: true }))
check('ignoreHour still respects the day', !S.isDue('3:8@America/New_York', at('2026-07-14T14:00:00Z'), { ignoreHour: true }))
check('label shows the zone', /EDT|EST|GMT-/.test(S.scheduleLabel('*:8@America/New_York')))
check('label for legacy says UTC', S.scheduleLabel('*:8').endsWith('UTC'))
check('timezone list starts with UTC and has many zones', S.timezoneOptions()[0] === 'UTC' && S.timezoneOptions().length > 20)

console.log('\nSeverity bands')
const def = V.bandsToThresholds(V.DEFAULT_BANDS)
check('default bands match the old policy', JSON.stringify(def) === JSON.stringify([
  { min: 0, max: 5, mode: 'notify' }, { min: 6, max: 8, mode: 'approval' }, { min: 9, max: 10, mode: 'auto' },
]))
check('every score 0–10 maps to exactly one band', Array.from({ length: 11 }, (_, s) => def.filter(t => s >= t.min && s <= t.max).length).every(n => n === 1))
check('old stored policy (descending order) round-trips', JSON.stringify(V.bandsToThresholds(V.thresholdsToBands([
  { min: 9, max: 10, mode: 'auto' }, { min: 6, max: 8, mode: 'approval' }, { min: 0, max: 5, mode: 'notify' },
]))) === JSON.stringify(def))
const noAuto = V.bandsToThresholds({ ...V.DEFAULT_BANDS, autoFrom: 11 })
check('top band can be turned off', noAuto.length === 2 && noAuto[1].max === 10 && noAuto[1].mode === 'approval')
check('8.5 no longer falls through the gap', V.resolveMode(8.5, def) === 'auto')
check('8.4 rounds into the approval band', V.resolveMode(8.4, def) === 'approval')
check('unmatched score falls back to approval', V.resolveMode(3, [{ min: 9, max: 10, mode: 'auto' }]) === 'approval')
check('null score is treated as 0', V.resolveMode(null, def) === 'notify')
check('normalize rejects unknown modes', V.normalizeThresholds([{ min: 0, max: 10, mode: 'yolo' }]) === null)
check('normalize rejects min > max', V.normalizeThresholds([{ min: 8, max: 2, mode: 'auto' }]) === null)
check('normalize rejects non-arrays', V.normalizeThresholds('nope') === null)
check('normalize clamps and rounds', JSON.stringify(V.normalizeThresholds([{ min: -3, max: 12.4, mode: 'notify' }])) === JSON.stringify([{ min: 0, max: 10, mode: 'notify' }]))
check('labels', V.severityLabel(0) === 'Informational' && V.severityLabel(7) === 'High' && V.severityLabel(10) === 'Critical' && V.severityLabel(null) === 'Unknown')
check('prompt rubric lists all five levels', V.rubricForPrompt().split('\n').length === 5)

console.log('\nOffline mode: paused pages')
const O = await import(pathToFileURL(join(ROOT, 'lib/offline-paths.ts')).href)
check('assistant is paused', O.isOfflinePausedPath('/chat'))
check('connection pages are paused', O.isOfflinePausedPath('/connectors/abc/manual'))
check('playbooks are paused', O.isOfflinePausedPath('/playbooks/123'))
check('Starlab is paused', O.isOfflinePausedPath('/starlab'))
check('downloads stay available', !O.isOfflinePausedPath('/settings/downloads'))
check('network access stays available', !O.isOfflinePausedPath('/settings/network'))
check('dashboard, usage and audit stay available', !['/dashboard', '/usage', '/audit'].some(O.isOfflinePausedPath))
check('prefix match is by segment (/chatter is not /chat)', !O.isOfflinePausedPath('/chatter'))

console.log('\nPersona coach')
const P = await import(pathToFileURL(join(ROOT, 'lib/persona-coach.ts')).href)
const generic = 'You are an AI onboarding concierge. Send warm, helpful welcome emails (SendGrid), answer setup questions from support threads, and nudge customers who stall — escalating to Slack when a human should step in.'
const g = P.checkPersona(generic)
check('bundle persona is missing business, audience, tone and facts', ['business', 'audience', 'tone', 'facts'].every(k => !g.find(c => c.key === k).covered))
check('bundle persona already covers hand-off (it says "escalating")', g.find(c => c.key === 'handoff').covered)
const filled = generic + '\n\n' + P.personaTemplate(g.filter(c => !c.covered).map(c => c.key))
check('template fills every missing section', P.checkPersona(filled).every(c => c.covered))
check('template leaves placeholders to replace', P.personaPlaceholders(filled).length === 4)
check('template does not repeat covered sections', !P.personaTemplate(['business']).includes('hand off'))
check('no placeholders in a finished persona', P.personaPlaceholders('Our product is Acme. Tone: friendly.').length === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)

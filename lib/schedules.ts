// Schedule format: "DOW:HOUR" or "DOW:HOUR@TIMEZONE".
//   DOW   0-6 (Sun=0..Sat=6) or * for every day
//   HOUR  0-23, in TIMEZONE
//   TIMEZONE an IANA name (e.g. America/New_York). Omitted = UTC, which keeps
//   every schedule saved before time zones existed working unchanged.
// Examples: "*:8" = every day at 8am UTC, "1:14@America/Chicago" = Mondays 2pm Central.

export const DOW_OPTIONS = [
  { value: '*', label: 'Every day' },
  { value: '0', label: 'Sundays' },
  { value: '1', label: 'Mondays' },
  { value: '2', label: 'Tuesdays' },
  { value: '3', label: 'Wednesdays' },
  { value: '4', label: 'Thursdays' },
  { value: '5', label: 'Fridays' },
  { value: '6', label: 'Saturdays' },
]

function hourText(h: number): string {
  return h === 0 ? '12am (midnight)' : h === 12 ? '12pm (noon)' : h < 12 ? `${h}am` : `${h - 12}pm`
}

// Labels carry no zone: the zone is chosen separately and shown next to it.
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourText(h) }))

// Shown first in the picker; the full IANA list follows when the runtime has it.
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Sao_Paulo', 'Europe/London', 'Europe/Dublin',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
]

export function isValidTimezone(tz: string | undefined | null): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** All zones the runtime knows, common ones first. */
export function timezoneOptions(extra?: string | null): string[] {
  let all: string[] = []
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    all = intl.supportedValuesOf?.('timeZone') ?? []
  } catch { /* older runtime: common list only */ }
  const set = new Set<string>(COMMON_TIMEZONES)
  if (extra && isValidTimezone(extra)) set.add(extra)
  for (const z of all) set.add(z)
  return [...set]
}

/** The viewer's own zone, for defaulting new schedules. */
export function browserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimezone(tz) ? tz : 'UTC'
  } catch {
    return 'UTC'
  }
}

// Parse a stored schedule string into DOW, hour and zone parts
export function parseSchedule(schedule: string): { dow: string; hour: string; tz: string } {
  const [spec, zone] = (schedule ?? '').split('@')
  const [dow, hour] = spec.split(':')
  return { dow: dow || '*', hour: hour || '8', tz: isValidTimezone(zone) ? zone : 'UTC' }
}

// Build a schedule string from DOW + hour (+ zone). UTC is stored bare.
export function buildSchedule(dow: string, hour: string, tz?: string | null): string {
  const base = `${dow}:${hour}`
  return tz && tz !== 'UTC' && isValidTimezone(tz) ? `${base}@${tz}` : base
}

function zoneAbbrev(tz: string, at: Date = new Date()): string {
  if (tz === 'UTC') return 'UTC'
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(at).find(p => p.type === 'timeZoneName')?.value
    return part ? `${part} (${tz})` : tz
  } catch {
    return tz
  }
}

// Human-readable label for a stored schedule value
export function scheduleLabel(schedule: string): string {
  const { dow, hour, tz } = parseSchedule(schedule)
  const dowLabel = DOW_OPTIONS.find(o => o.value === dow)?.label ?? 'Every day'
  const h = parseInt(hour, 10)
  const hourLabel = Number.isFinite(h) && h >= 0 && h <= 23 ? hourText(h) : `${hour}:00`
  return `${dowLabel} at ${hourLabel} ${zoneAbbrev(tz)}`
}

// Wall-clock hour + weekday of `now` in `tz`.
export function localParts(now: Date, tz: string): { hour: number; dow: number } {
  if (tz === 'UTC' || !isValidTimezone(tz)) return { hour: now.getUTCHours(), dow: now.getUTCDay() }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? now.getUTCHours()) % 24
  const wd = parts.find(p => p.type === 'weekday')?.value ?? ''
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
  return { hour, dow: dow < 0 ? now.getUTCDay() : dow }
}

// Returns true if the given schedule should fire at the given instant.
// The scheduler ticks hourly; this checks hour/day-of-week in the schedule's zone.
//
// `ignoreHour` is for hosts that can only tick once a day (Vercel Hobby): the
// schedule then fires on the right day at the tick's time, instead of never.
//
// Daylight saving: an hour that doesn't exist that day (2am on spring-forward)
// is skipped; an hour that happens twice (1am on fall-back) is de-duplicated by
// the runner's dedupe window.
export function isDue(schedule: string, now: Date, opts?: { ignoreHour?: boolean }): boolean {
  const { dow, hour, tz } = parseSchedule(schedule)
  const local = localParts(now, tz)
  if (!opts?.ignoreHour && local.hour !== parseInt(hour, 10)) return false
  if (dow !== '*' && local.dow !== parseInt(dow, 10)) return false
  return true
}

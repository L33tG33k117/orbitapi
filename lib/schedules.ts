// Schedule format: "DOW:HOUR" where DOW is 0-6 (Sun=0..Sat=6) or * for every day.
// Examples: "*:8" = every day at 8am UTC, "1:14" = every Monday at 2pm UTC.

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

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? 'am' : 'pm'
  const display = h === 0 ? '12am (midnight)' : h === 12 ? '12pm (noon)' : h < 12 ? `${h}am` : `${h - 12}pm`
  return { value: String(h), label: `${display} UTC` }
})

// Parse a stored schedule string into DOW and hour parts
export function parseSchedule(schedule: string): { dow: string; hour: string } {
  const [dow, hour] = schedule.split(':')
  return { dow: dow ?? '*', hour: hour ?? '8' }
}

// Build a schedule string from DOW + hour
export function buildSchedule(dow: string, hour: string): string {
  return `${dow}:${hour}`
}

// Human-readable label for a stored schedule value
export function scheduleLabel(schedule: string): string {
  const { dow, hour } = parseSchedule(schedule)
  const dowLabel = DOW_OPTIONS.find(o => o.value === dow)?.label ?? 'Every day'
  const hourLabel = HOUR_OPTIONS.find(o => o.value === hour)?.label ?? `${hour}am UTC`
  return `${dowLabel} at ${hourLabel}`
}

// Returns true if the given schedule should fire at the given UTC time.
// The cron job fires every hour at :00 — this checks hour/day-of-week match.
export function isDue(schedule: string, now: Date): boolean {
  const { dow, hour } = parseSchedule(schedule)
  const nowHour = now.getUTCHours()
  const nowDow = now.getUTCDay()

  if (nowHour !== parseInt(hour, 10)) return false
  if (dow !== '*' && nowDow !== parseInt(dow, 10)) return false
  return true
}

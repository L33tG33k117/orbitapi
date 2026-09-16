'use client'

import { useMemo } from 'react'
import { timezoneOptions } from '@/lib/schedules'

// Time zone picker for schedules. Common zones first, then every IANA zone the
// browser knows. The stored value is the IANA name (e.g. America/New_York).
export function TimezoneSelect({ value, onChange, className, id }: {
  value: string
  onChange: (tz: string) => void
  className?: string
  id?: string
}) {
  const options = useMemo(() => timezoneOptions(value), [value])
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Time zone"
      className={className ?? 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'}
    >
      {options.map(z => <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>)}
    </select>
  )
}

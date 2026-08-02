/**
 * Timezone utilities built on Intl, so travelling users get correct day
 * boundaries without pulling in a date library. All Date objects crossing
 * module boundaries are absolute instants (UTC); "local" is always explicit.
 */

export const DEFAULT_TZ = 'Europe/Helsinki'

const partsFormatter = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatter.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatter.set(timeZone, f)
  }
  return f
}

export interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(instant)
  const pick = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type)
    return found ? Number(found.value) : 0
  }
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  }
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (east positive). */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - instant.getTime()
}

/** Converts a wall-clock time in `timeZone` to the corresponding UTC instant. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  timeZone: string = DEFAULT_TZ,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  // Two passes settle DST transitions: the first offset may belong to the wrong side.
  const first = guess - tzOffsetMs(new Date(guess), timeZone)
  const second = guess - tzOffsetMs(new Date(first), timeZone)
  return new Date(second)
}

/** `YYYY-MM-DD` for the given instant as seen in `timeZone`. */
export function localDateKey(instant: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(instant, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** `HH:MM` for the given instant as seen in `timeZone`. */
export function localTimeLabel(instant: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(instant, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-')
  return { year: Number(y), month: Number(m), day: Number(d) }
}

/** [startOfDay, startOfNextDay) in UTC for a local calendar day. */
export function dayBounds(dateKey: string, timeZone: string = DEFAULT_TZ): { start: Date; end: Date } {
  const { year, month, day } = parseDateKey(dateKey)
  const start = zonedToUtc(year, month, day, 0, 0, timeZone)
  const end = zonedToUtc(year, month, day + 1, 0, 0, timeZone)
  return { start, end }
}

/** Monday-based week start (local) for the day containing `instant`. */
export function weekStartKey(instant: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(instant, timeZone)
  const noonUtc = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  const dow = noonUtc.getUTCDay() // 0 = Sunday
  const backoff = (dow + 6) % 7
  noonUtc.setUTCDate(noonUtc.getUTCDate() - backoff)
  return `${noonUtc.getUTCFullYear()}-${String(noonUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(
    noonUtc.getUTCDate(),
  ).padStart(2, '0')}`
}

/** Seven consecutive `YYYY-MM-DD` keys starting at `startKey`. */
export function weekDayKeys(startKey: string): string[] {
  const { year, month, day } = parseDateKey(startKey)
  const keys: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(Date.UTC(year, month - 1, day + i, 12, 0, 0))
    keys.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`,
    )
  }
  return keys
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000)
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000)
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

export function daysUntil(deadline: Date, now: Date = new Date()): number {
  return (deadline.getTime() - now.getTime()) / 86_400_000
}

const RU_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const
const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const

export function formatRuDate(instant: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(instant, timeZone)
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  return `${RU_WEEKDAYS[dow] ?? ''}, ${p.day} ${RU_MONTHS[p.month - 1] ?? ''}`
}

export function formatRuDateKey(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${RU_WEEKDAYS[dow] ?? ''}, ${day} ${RU_MONTHS[month - 1] ?? ''}`
}

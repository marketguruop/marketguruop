import { describe, expect, it } from 'vitest'
import {
  dayBounds,
  localDateKey,
  localTimeLabel,
  minutesBetween,
  overlaps,
  tzOffsetMs,
  weekDayKeys,
  weekStartKey,
  zonedToUtc,
} from '@/lib/dates'

const HELSINKI = 'Europe/Helsinki'
const BALI = 'Asia/Makassar' // UTC+8, no DST — the "user is travelling" case

describe('timezone conversion', () => {
  it('maps Helsinki summer time to UTC+3', () => {
    expect(tzOffsetMs(new Date('2026-08-02T10:00:00Z'), HELSINKI)).toBe(3 * 3_600_000)
  })

  it('maps Helsinki winter time to UTC+2', () => {
    expect(tzOffsetMs(new Date('2026-01-15T10:00:00Z'), HELSINKI)).toBe(2 * 3_600_000)
  })

  it('round-trips a wall clock time through UTC', () => {
    const instant = zonedToUtc(2026, 8, 2, 9, 30, HELSINKI)
    expect(instant.toISOString()).toBe('2026-08-02T06:30:00.000Z')
    expect(localTimeLabel(instant, HELSINKI)).toBe('09:30')
  })

  it('resolves the spring-forward transition without drifting a day', () => {
    // Finland moves 03:00 -> 04:00 on 2026-03-29.
    const instant = zonedToUtc(2026, 3, 29, 4, 0, HELSINKI)
    expect(localDateKey(instant, HELSINKI)).toBe('2026-03-29')
    expect(localTimeLabel(instant, HELSINKI)).toBe('04:00')
  })

  it('gives a different local date for the same instant in another zone', () => {
    const instant = new Date('2026-08-02T21:30:00Z')
    expect(localDateKey(instant, HELSINKI)).toBe('2026-08-03')
    expect(localDateKey(instant, BALI)).toBe('2026-08-03')
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-08-02')
  })
})

describe('dayBounds', () => {
  it('covers exactly 24 hours on a normal day', () => {
    const { start, end } = dayBounds('2026-08-02', HELSINKI)
    expect(minutesBetween(start, end)).toBe(24 * 60)
    expect(start.toISOString()).toBe('2026-08-01T21:00:00.000Z')
  })

  it('covers 23 hours on the spring-forward day', () => {
    const { start, end } = dayBounds('2026-03-29', HELSINKI)
    expect(minutesBetween(start, end)).toBe(23 * 60)
  })

  it('covers 25 hours on the fall-back day', () => {
    const { start, end } = dayBounds('2026-10-25', HELSINKI)
    expect(minutesBetween(start, end)).toBe(25 * 60)
  })

  it('respects the traveller timezone', () => {
    const { start } = dayBounds('2026-08-02', BALI)
    expect(start.toISOString()).toBe('2026-08-01T16:00:00.000Z')
  })
})

describe('week helpers', () => {
  it('starts the week on Monday', () => {
    // 2026-08-02 is a Sunday.
    expect(weekStartKey(new Date('2026-08-02T12:00:00Z'), HELSINKI)).toBe('2026-07-27')
    expect(weekStartKey(new Date('2026-08-03T12:00:00Z'), HELSINKI)).toBe('2026-08-03')
  })

  it('returns seven consecutive days across a month boundary', () => {
    expect(weekDayKeys('2026-07-27')).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })
})

describe('overlaps', () => {
  it('treats touching intervals as non-overlapping', () => {
    const a = new Date('2026-08-02T10:00:00Z')
    const b = new Date('2026-08-02T11:00:00Z')
    const c = new Date('2026-08-02T12:00:00Z')
    expect(overlaps(a, b, b, c)).toBe(false)
    expect(overlaps(a, c, b, c)).toBe(true)
  })
})

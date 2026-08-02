import { describe, expect, it } from 'vitest'
import { extractDeadline, heuristicParse, splitClauses } from '@/lib/ai/agents/heuristics'
import { InboxParseSchema } from '@/lib/ai/schemas'
import { localDateKey, zonedToUtc } from '@/lib/dates'

const TZ = 'Europe/Helsinki'
const NOW = zonedToUtc(2026, 8, 3, 9, 0, TZ) // Monday morning

describe('splitClauses', () => {
  it('splits the worked example into three actions', () => {
    const clauses = splitClauses(
      'Завтра нужно написать Саше, договориться о съёмке и придумать три Reels',
    )
    expect(clauses).toHaveLength(3)
    expect(clauses[0]).toContain('написать Саше')
    expect(clauses[1]).toContain('договориться')
    expect(clauses[2]).toContain('придумать три Reels')
  })

  it('does not split on commas that are not followed by a verb', () => {
    expect(splitClauses('Купить кофе, молоко и сахар')).toHaveLength(1)
  })

  it('splits on newlines and semicolons', () => {
    expect(splitClauses('Позвонить в студию;\nОплатить счёт')).toHaveLength(2)
  })
})

describe('extractDeadline', () => {
  it('resolves "завтра" to the next local day', () => {
    const { iso } = extractDeadline('завтра написать Саше', NOW, TZ)
    expect(iso).not.toBeNull()
    expect(localDateKey(new Date(iso!), TZ)).toBe('2026-08-04')
  })

  it('respects an explicit time', () => {
    const { iso } = extractDeadline('завтра в 15 позвонить', NOW, TZ)
    expect(new Date(iso!).toISOString()).toBe('2026-08-04T12:00:00.000Z')
  })

  it('resolves a weekday to the next occurrence', () => {
    const { iso } = extractDeadline('в пятницу отправить отчёт', NOW, TZ)
    expect(localDateKey(new Date(iso!), TZ)).toBe('2026-08-07')
  })

  it('returns null when there is no date', () => {
    expect(extractDeadline('разобрать почту', NOW, TZ).iso).toBeNull()
  })
})

describe('heuristicParse', () => {
  it('produces schema-valid output', () => {
    const result = heuristicParse('Завтра написать Саше и придумать три Reels', NOW, TZ)
    expect(InboxParseSchema.safeParse(result).success).toBe(true)
  })

  it('classifies content work as content', () => {
    const result = heuristicParse('Снять Reels про закулисье', NOW, TZ)
    expect(result.items[0]?.type).toBe('content')
    expect(result.items[0]?.energy).toBe('high')
  })

  it('classifies a purchase', () => {
    const result = heuristicParse('Купить свет для студии', NOW, TZ)
    expect(result.items[0]?.type).toBe('purchase')
  })

  it('maps a message to a task rather than a bare contact', () => {
    const result = heuristicParse('Написать Саше про съёмку', NOW, TZ)
    expect(result.items[0]?.type).toBe('task')
  })

  it('carries the deadline through to the item', () => {
    const result = heuristicParse('Завтра оплатить счёт', NOW, TZ)
    const item = result.items[0]
    expect(item?.type).toBe('finance')
    expect(item?.deadline).not.toBeNull()
    expect(localDateKey(new Date(item!.deadline!), TZ)).toBe('2026-08-04')
  })

  it('flags an event without a time for clarification instead of inventing one', () => {
    const result = heuristicParse('Встреча с Cider House', NOW, TZ)
    const item = result.items[0]
    expect(item?.type).toBe('event')
    expect(item?.startsAt).toBeNull()
    expect(item?.needsClarification).toBe(true)
    expect(item?.clarificationQuestion).toBeTruthy()
  })

  it('marks urgent wording as critical', () => {
    const result = heuristicParse('Срочно отправить брендбук', NOW, TZ)
    expect(result.items[0]?.priority).toBe('critical')
  })

  it('never claims high confidence for a local parse', () => {
    const result = heuristicParse('Позвонить в студию', NOW, TZ)
    expect(result.items[0]?.confidence).toBeLessThan(0.6)
  })

  it('always returns something for an unparseable note', () => {
    const result = heuristicParse('...', NOW, TZ)
    expect(result.items.length).toBeGreaterThan(0)
  })
})

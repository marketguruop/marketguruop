import { describe, expect, it } from 'vitest'
import { heuristicParse } from '@/lib/ai/agents/heuristics'
import { zonedToUtc } from '@/lib/dates'

const TZ = 'Europe/Helsinki'
const NOW = zonedToUtc(2026, 8, 3, 9, 0, TZ)

describe('title cleanup', () => {
  it('strips stacked date and filler prefixes', () => {
    const result = heuristicParse('Завтра нужно написать Саше', NOW, TZ)
    expect(result.items[0]?.title).toBe('Написать Саше')
  })

  it('keeps the deadline even after stripping the date word from the title', () => {
    const result = heuristicParse('Завтра нужно написать Саше', NOW, TZ)
    expect(result.items[0]?.deadline).not.toBeNull()
  })

  it('does not empty a title that is only a date word', () => {
    const result = heuristicParse('завтра', NOW, TZ)
    expect(result.items[0]?.title.length).toBeGreaterThan(0)
  })
})

describe('the worked example from the brief', () => {
  const result = heuristicParse(
    'Завтра нужно написать Саше, договориться о съёмке и придумать три Reels',
    NOW,
    TZ,
  )

  it('produces exactly three items', () => {
    expect(result.items).toHaveLength(3)
  })

  // Communication verbs classify as a task entity, not a Contact record —
  // "написать Саше" is work to do, not a new person to file.
  it('treats "написать Саше" as a task, not content', () => {
    expect(result.items[0]?.title).toBe('Написать Саше')
    expect(result.items[0]?.type).toBe('task')
  })

  it('treats "договориться о съёмке" as a task, not content', () => {
    expect(result.items[1]?.type).toBe('task')
  })

  it('treats "придумать три Reels" as content work', () => {
    expect(result.items[2]?.type).toBe('content')
    expect(result.items[2]?.energy).toBe('high')
  })
})

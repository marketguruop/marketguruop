import { describe, expect, it } from 'vitest'
import { DUPLICATE_THRESHOLD, normalizeTitle, titleSimilarity } from '@/lib/services/tasks'
import { selectAgent } from '@/lib/ai/orchestrator'
import { parseCommand } from '@/lib/integrations/telegram'

describe('normalizeTitle', () => {
  it('ignores punctuation, case and word order', () => {
    expect(normalizeTitle('Написать Саше!')).toBe(normalizeTitle('саше написать'))
  })

  it('drops filler words', () => {
    expect(normalizeTitle('Нужно написать Саше')).toBe(normalizeTitle('Написать Саше'))
  })
})

describe('titleSimilarity', () => {
  it('treats reworded duplicates as duplicates', () => {
    expect(titleSimilarity('Написать Саше про съёмку', 'Про съёмку написать Саше')).toBe(1)
  })

  it('keeps distinct tasks below the threshold', () => {
    expect(titleSimilarity('Написать Саше', 'Позвонить Марине')).toBeLessThan(DUPLICATE_THRESHOLD)
    expect(titleSimilarity('Оплатить счёт Cider House', 'Выставить счёт Cider House')).toBeLessThan(
      DUPLICATE_THRESHOLD,
    )
  })

  it('returns 0 when a title has no meaningful words', () => {
    expect(titleSimilarity('и на в', 'Написать Саше')).toBe(0)
  })
})

describe('agent routing', () => {
  it('routes planning questions to the Chief of Staff', () => {
    expect(selectAgent('покажи план дня')).toBe('chief_of_staff')
    expect(selectAgent('что у меня на неделю?')).toBe('chief_of_staff')
  })

  it('routes domain questions to the right specialist', () => {
    expect(selectAgent('придумай контент на неделю')).toBe('content')
    expect(selectAgent('сколько я заработала, есть неоплаченные счета?')).toBe('finance')
    expect(selectAgent('кому нужно ответить, есть просроченные договорённости?')).toBe('crm')
    expect(selectAgent('как мой сон влияет на энергию')).toBe('energy')
    expect(selectAgent('что можно автоматизировать в рутине')).toBe('automation')
  })

  it('treats raw thoughts as inbox capture', () => {
    expect(selectAgent('Завтра написать Саше и снять три ролика')).not.toBe('chief_of_staff')
    expect(selectAgent('купить свет для студии')).toBe('inbox')
  })
})

describe('telegram command parsing', () => {
  it('parses known commands with arguments', () => {
    expect(parseCommand('/add Позвонить в студию')).toEqual({
      command: 'add',
      args: 'Позвонить в студию',
    })
  })

  it('handles commands addressed to the bot', () => {
    expect(parseCommand('/today@emiliya_bot')).toEqual({ command: 'today', args: '' })
  })

  it('treats unknown commands and plain text as free input', () => {
    expect(parseCommand('/unknown thing').command).toBeNull()
    expect(parseCommand('просто мысль')).toEqual({ command: null, args: 'просто мысль' })
  })
})

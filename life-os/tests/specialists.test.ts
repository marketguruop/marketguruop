import { describe, expect, it } from 'vitest'
import { SPECIALIST_KEYS, isSpecialist } from '@/lib/ai/agents/specialists'
import { ProposalSchema, SpecialistSchema } from '@/lib/ai/schemas'
import { classifyAction } from '@/lib/approvals/policy'
import { AGENTS, AGENT_LIST } from '@/lib/ai/registry'

describe('specialist registry', () => {
  it('covers the six domain agents', () => {
    expect([...SPECIALIST_KEYS].sort()).toEqual(
      ['automation', 'business', 'content', 'crm', 'energy', 'finance'].sort(),
    )
  })

  it('does not claim the coordinating or capture agents', () => {
    for (const key of ['chief_of_staff', 'inbox', 'calendar', 'task', 'review']) {
      expect(isSpecialist(key)).toBe(false)
    }
  })

  it('every registered agent now writes to the database', () => {
    for (const agent of AGENT_LIST) {
      expect(agent.mode).toBe('core')
    }
  })

  it('every specialist has its own system prompt', () => {
    const prompts = new Set(SPECIALIST_KEYS.map((key) => AGENTS[key].systemPrompt))
    expect(prompts.size).toBe(SPECIALIST_KEYS.length)
  })
})

describe('proposal schema', () => {
  it('fills defaults so a sparse proposal is still complete', () => {
    const parsed = ProposalSchema.parse({
      kind: 'task',
      title: 'Напомнить об оплате',
      reason: 'Счёт просрочен',
    })
    expect(parsed.priority).toBe('medium')
    expect(parsed.estimatedMinutes).toBe(30)
    expect(parsed.confidence).toBe(0.6)
  })

  it('rejects an unknown proposal kind', () => {
    const result = ProposalSchema.safeParse({
      kind: 'send_email',
      title: 'x',
      reason: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an out-of-range duration', () => {
    expect(
      ProposalSchema.safeParse({ kind: 'task', title: 'x', reason: 'y', estimatedMinutes: 5000 }).success,
    ).toBe(false)
  })

  it('caps how much one run can propose', () => {
    const proposals = Array.from({ length: 13 }, (_, i) => ({
      kind: 'task' as const,
      title: `t${i}`,
      reason: 'r',
    }))
    expect(SpecialistSchema.safeParse({ summary: 's', findings: [], proposals }).success).toBe(false)
  })
})

describe('what specialists are allowed to write', () => {
  // Everything a specialist materialises must be internal and reversible.
  const WRITE_ACTIONS = ['create_task', 'update_task', 'create_idea', 'create_draft', 'create_note']

  it('only performs actions classified as safe', () => {
    for (const action of WRITE_ACTIONS) {
      expect(classifyAction(action)).toBe('safe')
    }
  })

  it('never performs an outward-facing action directly', () => {
    for (const action of [
      'send_telegram_message',
      'send_email',
      'publish_content',
      'enable_automation',
      'create_calendar_event',
      'update_finance_record',
    ]) {
      expect(WRITE_ACTIONS).not.toContain(action)
      expect(classifyAction(action)).toBe('confirm')
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  CONFIRM_ACTIONS,
  FORBIDDEN_ACTIONS,
  SAFE_ACTIONS,
  classifyAction,
  isAutoApplicable,
} from '@/lib/approvals/policy'

describe('action policy', () => {
  it('lets safe actions run automatically', () => {
    for (const action of SAFE_ACTIONS) {
      expect(classifyAction(action)).toBe('safe')
      expect(isAutoApplicable(action)).toBe(true)
    }
  })

  it('requires confirmation for outward-facing actions', () => {
    for (const action of CONFIRM_ACTIONS) {
      expect(classifyAction(action)).toBe('confirm')
      expect(isAutoApplicable(action)).toBe(false)
    }
  })

  it('blocks forbidden actions outright', () => {
    for (const action of FORBIDDEN_ACTIONS) {
      expect(classifyAction(action)).toBe('forbidden')
      expect(isAutoApplicable(action)).toBe(false)
    }
  })

  it('fails closed on an unknown action', () => {
    expect(classifyAction('launch_missile')).toBe('confirm')
    expect(isAutoApplicable('launch_missile')).toBe(false)
  })

  it('never classifies calendar writes or messages as safe', () => {
    for (const action of ['create_calendar_event', 'send_telegram_message', 'publish_content', 'delete_task']) {
      expect(classifyAction(action)).not.toBe('safe')
    }
  })

  it('keeps the three tiers disjoint', () => {
    const safe = new Set<string>(SAFE_ACTIONS)
    const confirm = new Set<string>(CONFIRM_ACTIONS)
    const forbidden = new Set<string>(FORBIDDEN_ACTIONS)
    for (const action of safe) {
      expect(confirm.has(action)).toBe(false)
      expect(forbidden.has(action)).toBe(false)
    }
    for (const action of confirm) {
      expect(forbidden.has(action)).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFER_PENALTY_PER_STEP,
  MAX_DEFERS,
  SCORING_WEIGHTS,
  contextMatch,
  deadlineUrgency,
  dependencyScore,
  durationFit,
  energyMatch,
  needsDeferReview,
  scoreTask,
  type ScorableTask,
  type ScoringSlot,
} from '@/lib/scheduling/scoring'

const NOW = new Date('2026-08-02T09:00:00Z')

const baseTask: ScorableTask = {
  id: 't1',
  priority: 'medium',
  estimatedMinutes: 60,
  energy: 'medium',
}

const baseSlot: ScoringSlot = {
  start: NOW,
  energy: 'medium',
  availableMinutes: 120,
}

describe('scoring weights', () => {
  it('sum to exactly 1', () => {
    const total = Object.values(SCORING_WEIGHTS).reduce((s, w) => s + w, 0)
    expect(total).toBeCloseTo(1, 10)
  })
})

describe('deadlineUrgency', () => {
  it('returns 1 for a deadline that has passed', () => {
    expect(deadlineUrgency(new Date('2026-08-01T09:00:00Z'), NOW)).toBe(1)
  })

  it('decays as the deadline moves away', () => {
    const soon = deadlineUrgency(new Date('2026-08-03T09:00:00Z'), NOW)
    const later = deadlineUrgency(new Date('2026-08-20T09:00:00Z'), NOW)
    expect(soon).toBeGreaterThan(later)
    expect(later).toBeGreaterThan(0)
  })

  it('uses a neutral baseline when there is no deadline', () => {
    expect(deadlineUrgency(null, NOW)).toBe(0.3)
  })
})

describe('energyMatch', () => {
  it('is perfect on an exact match', () => {
    expect(energyMatch('high', 'high')).toBe(1)
  })

  it('penalises a slot with less energy than the task needs', () => {
    expect(energyMatch('high', 'low')).toBeLessThan(energyMatch('high', 'medium'))
    expect(energyMatch('high', 'low')).toBeLessThan(0.2)
  })

  it('only lightly penalises a slot with spare energy', () => {
    expect(energyMatch('low', 'high')).toBeGreaterThan(0.6)
  })
})

describe('durationFit', () => {
  it('is zero when the task does not fit', () => {
    expect(durationFit(90, 60)).toBe(0)
  })

  it('prefers slots the task nearly fills', () => {
    expect(durationFit(110, 120)).toBeGreaterThan(durationFit(20, 120))
  })
})

describe('contextMatch and dependencyScore', () => {
  it('rewards a matching context', () => {
    expect(contextMatch('deep', 'deep')).toBe(1)
    expect(contextMatch('deep', 'admin')).toBeLessThan(0.5)
    expect(contextMatch(null, 'admin')).toBe(0.5)
  })

  it('caps dependency score at 1', () => {
    expect(dependencyScore(0)).toBe(0)
    expect(dependencyScore(9)).toBe(1)
  })
})

describe('scoreTask', () => {
  it('ranks a critical task with a near deadline above a low-priority one', () => {
    const urgent = scoreTask(
      { ...baseTask, id: 'urgent', priority: 'critical', deadline: new Date('2026-08-02T18:00:00Z') },
      baseSlot,
      NOW,
    )
    const relaxed = scoreTask({ ...baseTask, id: 'relaxed', priority: 'low' }, baseSlot, NOW)
    expect(urgent.total).toBeGreaterThan(relaxed.total)
  })

  it('marks a task that does not fit as ineligible', () => {
    const result = scoreTask({ ...baseTask, estimatedMinutes: 300 }, baseSlot, NOW)
    expect(result.eligible).toBe(false)
    expect(result.total).toBe(0)
  })

  it('marks a blocked task as ineligible', () => {
    const result = scoreTask({ ...baseTask, blocked: true }, baseSlot, NOW)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('Заблокирована')
  })

  it('applies the deferral penalty and caps it', () => {
    const clean = scoreTask(baseTask, baseSlot, NOW)
    const deferred = scoreTask({ ...baseTask, deferCount: 2 }, baseSlot, NOW)
    const overDeferred = scoreTask({ ...baseTask, deferCount: 12 }, baseSlot, NOW)

    expect(deferred.penalty).toBeCloseTo(2 * DEFER_PENALTY_PER_STEP, 10)
    expect(overDeferred.penalty).toBeCloseTo(MAX_DEFERS * DEFER_PENALTY_PER_STEP, 10)
    expect(deferred.total).toBeLessThan(clean.total)
  })

  it('keeps the total inside 0..1', () => {
    const maxed = scoreTask(
      {
        ...baseTask,
        priority: 'critical',
        deadline: new Date('2026-08-01T00:00:00Z'),
        strategicValue: 1,
        incomeImpact: 1,
        mediaImpact: 1,
        healthImpact: 1,
        blockingCount: 5,
        estimatedMinutes: 120,
      },
      { ...baseSlot, context: 'deep' },
      NOW,
    )
    expect(maxed.total).toBeGreaterThan(0)
    expect(maxed.total).toBeLessThanOrEqual(1)
  })
})

describe('needsDeferReview', () => {
  it('triggers on the third deferral', () => {
    expect(needsDeferReview(2)).toBe(false)
    expect(needsDeferReview(3)).toBe(true)
  })
})

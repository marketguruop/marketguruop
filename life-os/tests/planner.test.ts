import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLANNER_CONFIG,
  checkWorkoutConflict,
  contextForHour,
  energyForHour,
  expandEvent,
  minimalDayPlan,
  planDay,
  planWeek,
  type PlannerTask,
} from '@/lib/scheduling/planner'
import { minutesBetween, overlaps, zonedToUtc } from '@/lib/dates'

const TZ = 'Europe/Helsinki'
const DATE = '2026-08-03' // Monday
const NOW = zonedToUtc(2026, 8, 3, 8, 0, TZ)

function task(overrides: Partial<PlannerTask> & { id: string }): PlannerTask {
  return {
    title: `Задача ${overrides.id}`,
    priority: 'medium',
    energy: 'medium',
    estimatedMinutes: 60,
    ...overrides,
  }
}

describe('energy and context curves', () => {
  it('treats the morning as high-energy deep time', () => {
    expect(energyForHour(9)).toBe('high')
    expect(contextForHour(9)).toBe('deep')
    expect(energyForHour(14)).toBe('medium')
    expect(energyForHour(19)).toBe('low')
  })
})

describe('expandEvent', () => {
  it('adds prep, travel there and back, and recovery around the event', () => {
    const blocks = expandEvent({
      id: 'e1',
      title: 'Съёмка',
      startsAt: zonedToUtc(2026, 8, 3, 13, 0, TZ),
      endsAt: zonedToUtc(2026, 8, 3, 16, 0, TZ),
      prepMinutes: 60,
      travelMinutes: 30,
      recoveryMinutes: 30,
    })
    const kinds = blocks.map((b) => b.kind)
    expect(kinds).toEqual(['prep', 'travel', 'meeting', 'travel', 'recovery'])
    // Prep starts 90 minutes before the event (60 prep + 30 travel).
    expect(minutesBetween(blocks[0]!.start, zonedToUtc(2026, 8, 3, 13, 0, TZ))).toBe(90)
  })
})

describe('planDay', () => {
  it('never books more than the utilization ceiling', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task({ id: `t${i}`, estimatedMinutes: 60 }))
    const plan = planDay({ dateKey: DATE, timezone: TZ, now: NOW, events: [], tasks })

    expect(plan.utilization).toBeLessThanOrEqual(DEFAULT_PLANNER_CONFIG.maxUtilization + 1e-9)
    expect(plan.plannedTaskMinutes).toBeLessThanOrEqual(
      plan.availableMinutes * DEFAULT_PLANNER_CONFIG.maxUtilization,
    )
  })

  it('always leaves at least 25% of the day free', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task({ id: `t${i}` }))
    const plan = planDay({ dateKey: DATE, timezone: TZ, now: NOW, events: [], tasks })
    expect(plan.freeMinutes).toBeGreaterThanOrEqual(plan.availableMinutes * 0.25 - 1)
  })

  it('produces no overlapping blocks', () => {
    const plan = planDay({
      dateKey: DATE,
      timezone: TZ,
      now: NOW,
      tasks: Array.from({ length: 6 }, (_, i) => task({ id: `t${i}` })),
      events: [
        {
          id: 'e1',
          title: 'Созвон',
          startsAt: zonedToUtc(2026, 8, 3, 11, 0, TZ),
          endsAt: zonedToUtc(2026, 8, 3, 12, 0, TZ),
        },
      ],
    })

    for (let i = 0; i < plan.blocks.length; i += 1) {
      for (let j = i + 1; j < plan.blocks.length; j += 1) {
        const a = plan.blocks[i]!
        const b = plan.blocks[j]!
        expect(overlaps(a.start, a.end, b.start, b.end)).toBe(false)
      }
    }
  })

  it('does not place more than three heavy blocks in a row', () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task({ id: `h${i}`, energy: 'high', estimatedMinutes: 60 }),
    )
    const plan = planDay({ dateKey: DATE, timezone: TZ, now: NOW, events: [], tasks })

    let streak = 0
    let maxStreak = 0
    for (const block of plan.blocks) {
      if (block.taskId && block.load === 'high') {
        streak += 1
        maxStreak = Math.max(maxStreak, streak)
      } else if (block.kind === 'recovery' || block.kind === 'buffer') {
        streak = 0
      }
    }
    expect(maxStreak).toBeLessThanOrEqual(DEFAULT_PLANNER_CONFIG.maxConsecutiveHeavy)
  })

  it('picks exactly one main task and at most three outcomes', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => task({ id: `t${i}`, estimatedMinutes: 45 }))
    const plan = planDay({ dateKey: DATE, timezone: TZ, now: NOW, events: [], tasks })
    expect(plan.mainTaskId).not.toBeNull()
    expect(plan.outcomes.length).toBeLessThanOrEqual(DEFAULT_PLANNER_CONFIG.maxOutcomesPerDay)
  })

  it('reports every task it could not place instead of dropping it', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task({ id: `t${i}`, estimatedMinutes: 90 }))
    const plan = planDay({ dateKey: DATE, timezone: TZ, now: NOW, events: [], tasks })
    const placed = plan.blocks.filter((b) => b.taskId).length
    expect(placed + plan.deferred.length).toBe(tasks.length)
  })

  it('leaves travel and prep time untouched around an event', () => {
    const plan = planDay({
      dateKey: DATE,
      timezone: TZ,
      now: NOW,
      tasks: [task({ id: 'a', estimatedMinutes: 60 })],
      events: [
        {
          id: 'e1',
          title: 'Съёмка',
          startsAt: zonedToUtc(2026, 8, 3, 13, 0, TZ),
          endsAt: zonedToUtc(2026, 8, 3, 16, 0, TZ),
          prepMinutes: 60,
          travelMinutes: 30,
          recoveryMinutes: 30,
        },
      ],
    })

    const taskBlock = plan.blocks.find((b) => b.taskId === 'a')
    const prep = plan.blocks.find((b) => b.kind === 'prep')
    expect(prep).toBeDefined()
    if (taskBlock && prep) {
      expect(overlaps(taskBlock.start, taskBlock.end, prep.start, prep.end)).toBe(false)
    }
  })

  it('does not schedule a task that is blocked by a dependency', () => {
    const plan = planDay({
      dateKey: DATE,
      timezone: TZ,
      now: NOW,
      events: [],
      tasks: [task({ id: 'blocked', blocked: true })],
    })
    expect(plan.blocks.some((b) => b.taskId === 'blocked')).toBe(false)
    expect(plan.deferred[0]?.reason).toContain('Заблокирована')
  })

  it('warns when a task is deferred for the third time', () => {
    const plan = planDay({
      dateKey: DATE,
      timezone: TZ,
      now: NOW,
      events: [],
      tasks: [task({ id: 'old', blocked: true, deferCount: 3 })],
    })
    expect(plan.deferred[0]?.needsReview).toBe(true)
    expect(plan.warnings.join(' ')).toContain('переносится')
  })
})

describe('planWeek', () => {
  it('never schedules the same task twice across the week', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task({ id: `t${i}` }))
    const week = planWeek({
      dateKeys: ['2026-08-03', '2026-08-04', '2026-08-05'],
      timezone: TZ,
      now: NOW,
      eventsByDay: {},
      tasks,
    })

    const scheduled = week.days.flatMap((d) => d.blocks.map((b) => b.taskId).filter(Boolean))
    expect(new Set(scheduled).size).toBe(scheduled.length)
  })

  it('flags tasks that do not fit into the week', () => {
    const tasks = Array.from({ length: 60 }, (_, i) => task({ id: `t${i}`, estimatedMinutes: 120 }))
    const week = planWeek({
      dateKeys: ['2026-08-03', '2026-08-04'],
      timezone: TZ,
      now: NOW,
      eventsByDay: {},
      tasks,
    })
    expect(week.unscheduled.length).toBeGreaterThan(0)
    expect(week.warnings.join(' ')).toContain('не поместились')
  })
})

describe('workout rules', () => {
  it('rejects a run and a heavy strength session on the same day', () => {
    expect(
      checkWorkoutConflict([
        { kind: 'run', intensity: 'medium' },
        { kind: 'strength', intensity: 'high' },
      ]),
    ).toContain('Бег и тяжёлая силовая')
  })

  it('allows a run with a light strength session', () => {
    expect(
      checkWorkoutConflict([
        { kind: 'run', intensity: 'medium' },
        { kind: 'strength', intensity: 'low' },
      ]),
    ).toBeNull()
  })
})

describe('minimalDayPlan', () => {
  it('keeps only fixed commitments and the main task', () => {
    const plan = planDay({
      dateKey: DATE,
      timezone: TZ,
      now: NOW,
      tasks: [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })],
      events: [
        {
          id: 'e1',
          title: 'Созвон',
          startsAt: zonedToUtc(2026, 8, 3, 11, 0, TZ),
          endsAt: zonedToUtc(2026, 8, 3, 12, 0, TZ),
        },
      ],
    })
    const minimal = minimalDayPlan(plan)
    const taskBlocks = minimal.filter((b) => b.taskId)
    expect(taskBlocks.length).toBeLessThanOrEqual(1)
    expect(minimal.some((b) => b.kind === 'meeting')).toBe(true)
  })
})

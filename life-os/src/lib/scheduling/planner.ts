import type { BlockKind, EnergyLevel, TaskContext } from '@/lib/domain/enums'
import { addMinutes, dayBounds, minutesBetween, zonedParts, zonedToUtc, DEFAULT_TZ } from '@/lib/dates'
import { needsDeferReview, scoreTask, type ScorableTask } from '@/lib/scheduling/scoring'

/**
 * Deterministic week/day planner. Pure: no I/O, no clock reads except the `now`
 * passed in, so the whole thing is unit-testable.
 */

export interface PlannerConfig {
  /** Local minutes from midnight. */
  workStartMinute: number
  workEndMinute: number
  /** Hard ceiling on how much of the free time may be booked. */
  maxUtilization: number
  /** Breathing room inserted between any two blocks. */
  minGapMinutes: number
  maxConsecutiveHeavy: number
  maxOutcomesPerDay: number
  /** Reserve windows shorter than this are not written out as buffers. */
  minReserveMinutes: number
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  workStartMinute: 9 * 60,
  workEndMinute: 21 * 60,
  maxUtilization: 0.75,
  minGapMinutes: 15,
  maxConsecutiveHeavy: 3,
  maxOutcomesPerDay: 3,
  minReserveMinutes: 30,
}

export interface PlannerEvent {
  id: string
  title: string
  startsAt: Date
  endsAt: Date
  travelMinutes?: number
  prepMinutes?: number
  recoveryMinutes?: number
  load?: EnergyLevel
}

export interface PlannerTask extends ScorableTask {
  title: string
}

export interface PlannerWorkout {
  kind: string
  intensity: string
}

export interface PlanDayInput {
  dateKey: string
  timezone?: string
  now?: Date
  events: PlannerEvent[]
  tasks: PlannerTask[]
  workouts?: PlannerWorkout[]
  config?: Partial<PlannerConfig>
}

export interface PlannedBlock {
  key: string
  taskId?: string
  eventId?: string
  title: string
  kind: BlockKind
  load: EnergyLevel
  start: Date
  end: Date
  score: number
  reason: string
}

export interface DeferredTask {
  taskId: string
  title: string
  reason: string
  needsReview: boolean
}

export interface DayPlan {
  dateKey: string
  blocks: PlannedBlock[]
  availableMinutes: number
  plannedTaskMinutes: number
  bookedMinutes: number
  freeMinutes: number
  utilization: number
  mainTaskId: string | null
  outcomes: string[]
  warnings: string[]
  deferred: DeferredTask[]
}

interface Interval {
  start: Date
  end: Date
}

/** Expected energy for a local hour of day. */
export function energyForHour(hour: number): EnergyLevel {
  if (hour < 12) return 'high'
  if (hour < 16) return 'medium'
  return 'low'
}

/** Expected work context for a local hour of day. */
export function contextForHour(hour: number): TaskContext {
  if (hour < 12) return 'deep'
  if (hour < 16) return 'creative'
  return 'admin'
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: Interval[] = []
  for (const current of sorted) {
    const last = merged[merged.length - 1]
    if (last && current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) last.end = current.end
    } else {
      merged.push({ start: new Date(current.start), end: new Date(current.end) })
    }
  }
  return merged
}

function clip(interval: Interval, bound: Interval): Interval | null {
  const start = new Date(Math.max(interval.start.getTime(), bound.start.getTime()))
  const end = new Date(Math.min(interval.end.getTime(), bound.end.getTime()))
  return end.getTime() > start.getTime() ? { start, end } : null
}

/** Expands an event into its prep / travel / meeting / travel / recovery blocks. */
export function expandEvent(event: PlannerEvent): PlannedBlock[] {
  const prep = event.prepMinutes ?? 0
  const travel = event.travelMinutes ?? 0
  const recovery = event.recoveryMinutes ?? 0
  const blocks: PlannedBlock[] = []

  let cursor = new Date(event.startsAt.getTime() - (prep + travel) * 60_000)
  if (prep > 0) {
    const end = addMinutes(cursor, prep)
    blocks.push({
      key: `${event.id}:prep`,
      eventId: event.id,
      title: `Подготовка: ${event.title}`,
      kind: 'prep',
      load: 'low',
      start: cursor,
      end,
      score: 0,
      reason: 'Время на сборы и макияж перед событием',
    })
    cursor = end
  }
  if (travel > 0) {
    const end = addMinutes(cursor, travel)
    blocks.push({
      key: `${event.id}:travel-to`,
      eventId: event.id,
      title: `Дорога: ${event.title}`,
      kind: 'travel',
      load: 'low',
      start: cursor,
      end,
      score: 0,
      reason: 'Дорога до места',
    })
  }

  blocks.push({
    key: `${event.id}:event`,
    eventId: event.id,
    title: event.title,
    kind: 'meeting',
    load: event.load ?? 'medium',
    start: event.startsAt,
    end: event.endsAt,
    score: 0,
    reason: 'Событие из календаря',
  })

  let after = new Date(event.endsAt)
  if (travel > 0) {
    const end = addMinutes(after, travel)
    blocks.push({
      key: `${event.id}:travel-back`,
      eventId: event.id,
      title: `Дорога обратно: ${event.title}`,
      kind: 'travel',
      load: 'low',
      start: after,
      end,
      score: 0,
      reason: 'Дорога обратно',
    })
    after = end
  }
  if (recovery > 0) {
    blocks.push({
      key: `${event.id}:recovery`,
      eventId: event.id,
      title: `Восстановление после: ${event.title}`,
      kind: 'recovery',
      load: 'low',
      start: after,
      end: addMinutes(after, recovery),
      score: 0,
      reason: 'Восстановление после нагрузки',
    })
  }

  return blocks
}

function freeWindows(bound: Interval, occupied: Interval[], gapMinutes: number): Interval[] {
  const padded = occupied.map((i) => ({
    start: addMinutes(i.start, -gapMinutes),
    end: addMinutes(i.end, gapMinutes),
  }))
  const merged = mergeIntervals(padded)
  const windows: Interval[] = []
  let cursor = new Date(bound.start)
  for (const busy of merged) {
    if (busy.start.getTime() > cursor.getTime()) {
      const w = clip({ start: cursor, end: busy.start }, bound)
      if (w) windows.push(w)
    }
    if (busy.end.getTime() > cursor.getTime()) cursor = new Date(busy.end)
  }
  if (cursor.getTime() < bound.end.getTime()) {
    windows.push({ start: cursor, end: new Date(bound.end) })
  }
  return windows.filter((w) => minutesBetween(w.start, w.end) > 0)
}

export function planDay(input: PlanDayInput): DayPlan {
  const config = { ...DEFAULT_PLANNER_CONFIG, ...input.config }
  const timezone = input.timezone ?? DEFAULT_TZ
  const now = input.now ?? new Date()
  const warnings: string[] = []

  const { start: dayStart, end: dayEnd } = dayBounds(input.dateKey, timezone)
  const [y, m, d] = input.dateKey.split('-').map(Number)
  const workStart = zonedToUtc(
    y ?? 1970,
    m ?? 1,
    d ?? 1,
    Math.floor(config.workStartMinute / 60),
    config.workStartMinute % 60,
    timezone,
  )
  const workEnd = zonedToUtc(
    y ?? 1970,
    m ?? 1,
    d ?? 1,
    Math.floor(config.workEndMinute / 60),
    config.workEndMinute % 60,
    timezone,
  )
  const bound: Interval = {
    start: new Date(Math.max(workStart.getTime(), dayStart.getTime())),
    end: new Date(Math.min(workEnd.getTime(), dayEnd.getTime())),
  }

  // 1. Fixed blocks from the calendar.
  const eventBlocks = input.events
    .flatMap(expandEvent)
    .map((b) => {
      const clipped = clip({ start: b.start, end: b.end }, { start: dayStart, end: dayEnd })
      return clipped ? { ...b, start: clipped.start, end: clipped.end } : null
    })
    .filter((b): b is PlannedBlock => b !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  // 2. Free windows inside working hours, padded by the minimum gap.
  const occupied = eventBlocks.map((b) => ({ start: b.start, end: b.end }))
  const windows = freeWindows(bound, occupied, config.minGapMinutes)
  const availableMinutes = windows.reduce((sum, w) => sum + minutesBetween(w.start, w.end), 0)
  const capacityMinutes = Math.floor(availableMinutes * config.maxUtilization)

  // 3. Greedy placement, best-scoring task first per window.
  const remaining = new Map(input.tasks.map((t) => [t.id, t]))
  const placed: PlannedBlock[] = []
  const deferred: DeferredTask[] = []
  let usedMinutes = 0
  let heavyStreak = 0

  for (const window of windows) {
    let cursor = new Date(window.start)
    while (minutesBetween(cursor, window.end) >= 15 && usedMinutes < capacityMinutes) {
      const windowLeft = minutesBetween(cursor, window.end)
      const budgetLeft = capacityMinutes - usedMinutes
      const slotMinutes = Math.min(windowLeft, budgetLeft)
      const hour = zonedParts(cursor, timezone).hour
      const slot = {
        start: cursor,
        energy: energyForHour(hour),
        context: contextForHour(hour),
        availableMinutes: slotMinutes,
      }

      let best: { task: PlannerTask; score: number; reason: string } | null = null
      for (const task of remaining.values()) {
        const result = scoreTask(task, slot, now)
        if (!result.eligible) continue
        const isHeavy = task.energy === 'high'
        if (isHeavy && heavyStreak >= config.maxConsecutiveHeavy) continue
        if (!best || result.total > best.score) {
          best = { task, score: result.total, reason: result.reason }
        }
      }

      if (!best) {
        if (heavyStreak >= config.maxConsecutiveHeavy && windowLeft >= config.minGapMinutes) {
          const end = addMinutes(cursor, Math.min(30, windowLeft))
          placed.push({
            key: `buffer:${cursor.toISOString()}`,
            title: 'Пауза после тяжёлых блоков',
            kind: 'recovery',
            load: 'low',
            start: cursor,
            end,
            score: 0,
            reason: `Подряд больше ${config.maxConsecutiveHeavy} тяжёлых блоков — нужен перерыв`,
          })
          heavyStreak = 0
          cursor = end
          continue
        }
        break
      }

      const end = addMinutes(cursor, best.task.estimatedMinutes)
      placed.push({
        key: `task:${best.task.id}`,
        taskId: best.task.id,
        title: best.task.title,
        kind: best.task.energy === 'high' ? 'focus' : 'admin',
        load: best.task.energy,
        start: cursor,
        end,
        score: best.score,
        reason: best.reason,
      })
      usedMinutes += best.task.estimatedMinutes
      heavyStreak = best.task.energy === 'high' ? heavyStreak + 1 : 0
      remaining.delete(best.task.id)
      cursor = addMinutes(end, config.minGapMinutes)
    }
  }

  // 4. Everything left over is explicitly reported, not silently dropped.
  for (const task of remaining.values()) {
    const nextDeferCount = (task.deferCount ?? 0) + 1
    const review = needsDeferReview(nextDeferCount)
    deferred.push({
      taskId: task.id,
      title: task.title,
      reason: task.blocked
        ? 'Заблокирована зависимостью'
        : usedMinutes >= capacityMinutes
          ? 'День заполнен на лимит 75%'
          : 'Не нашлось подходящего окна',
      needsReview: review,
    })
    if (review) {
      warnings.push(
        `«${task.title}» переносится ${nextDeferCount}-й раз — удалить, делегировать или пересмотреть.`,
      )
    }
  }

  // 5. Reserve what is left as explicit buffer, so the day is never 100% booked.
  const allBusy = mergeIntervals([...occupied, ...placed.map((b) => ({ start: b.start, end: b.end }))])
  const reserves = freeWindows(bound, allBusy, 0).filter(
    (w) => minutesBetween(w.start, w.end) >= config.minReserveMinutes,
  )
  const bufferBlocks: PlannedBlock[] = reserves.map((w) => ({
    key: `reserve:${w.start.toISOString()}`,
    title: 'Резерв',
    kind: 'buffer',
    load: 'low',
    start: w.start,
    end: w.end,
    score: 0,
    reason: 'Свободное окно — защита от перегрузки',
  }))

  const blocks = [...eventBlocks, ...placed, ...bufferBlocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )

  const taskBlocks = placed.filter((b) => b.taskId)
  const ranked = [...taskBlocks].sort((a, b) => b.score - a.score)
  const mainTaskId = ranked[0]?.taskId ?? null
  const outcomes = ranked.slice(0, config.maxOutcomesPerDay).map((b) => b.title)

  const bookedMinutes =
    eventBlocks.reduce((s, b) => s + minutesBetween(b.start, b.end), 0) + usedMinutes
  const utilization = availableMinutes > 0 ? usedMinutes / availableMinutes : 0
  const freeMinutes = Math.max(0, availableMinutes - usedMinutes)

  if (utilization > config.maxUtilization + 1e-9) {
    warnings.push(`Перегрузка: занято ${Math.round(utilization * 100)}% свободного времени.`)
  }
  if (availableMinutes === 0 && input.tasks.length > 0) {
    warnings.push('В этот день нет свободных окон — задачи не размещены.')
  }
  const workoutWarning = checkWorkoutConflict(input.workouts ?? [])
  if (workoutWarning) warnings.push(workoutWarning)

  return {
    dateKey: input.dateKey,
    blocks,
    availableMinutes,
    plannedTaskMinutes: usedMinutes,
    bookedMinutes,
    freeMinutes,
    utilization,
    mainTaskId,
    outcomes,
    warnings,
    deferred,
  }
}

/** Running and heavy strength work on the same day is disallowed. */
export function checkWorkoutConflict(workouts: PlannerWorkout[]): string | null {
  const hasRun = workouts.some((w) => w.kind === 'run')
  const hasHeavyStrength = workouts.some((w) => w.kind === 'strength' && w.intensity === 'high')
  return hasRun && hasHeavyStrength
    ? 'Бег и тяжёлая силовая в один день — перенеси одну тренировку.'
    : null
}

export interface PlanWeekInput {
  dateKeys: string[]
  timezone?: string
  now?: Date
  eventsByDay: Record<string, PlannerEvent[]>
  workoutsByDay?: Record<string, PlannerWorkout[]>
  tasks: PlannerTask[]
  config?: Partial<PlannerConfig>
}

export interface WeekPlan {
  days: DayPlan[]
  unscheduled: DeferredTask[]
  warnings: string[]
  totalPlannedMinutes: number
  averageUtilization: number
}

export function planWeek(input: PlanWeekInput): WeekPlan {
  const pool = new Map(input.tasks.map((t) => [t.id, t]))
  const days: DayPlan[] = []

  for (const dateKey of input.dateKeys) {
    const plan = planDay({
      dateKey,
      timezone: input.timezone,
      now: input.now,
      events: input.eventsByDay[dateKey] ?? [],
      workouts: input.workoutsByDay?.[dateKey] ?? [],
      tasks: [...pool.values()],
      config: input.config,
    })
    for (const block of plan.blocks) {
      if (block.taskId) pool.delete(block.taskId)
    }
    days.push(plan)
  }

  const unscheduled: DeferredTask[] = [...pool.values()].map((task) => ({
    taskId: task.id,
    title: task.title,
    reason: 'Не поместилась в неделю',
    needsReview: needsDeferReview((task.deferCount ?? 0) + 1),
  }))

  const warnings = days.flatMap((d) => d.warnings)
  if (unscheduled.length > 0) {
    warnings.push(
      `${unscheduled.length} задач(и) не поместились в неделю — сократи объём или делегируй.`,
    )
  }

  const totalPlannedMinutes = days.reduce((s, d) => s + d.plannedTaskMinutes, 0)
  const withCapacity = days.filter((d) => d.availableMinutes > 0)
  const averageUtilization =
    withCapacity.length > 0
      ? withCapacity.reduce((s, d) => s + d.utilization, 0) / withCapacity.length
      : 0

  return { days, unscheduled, warnings, totalPlannedMinutes, averageUtilization }
}

/** The "low energy" version of a day: fixed events, the main task, nothing else. */
export function minimalDayPlan(plan: DayPlan): PlannedBlock[] {
  return plan.blocks.filter(
    (b) => b.kind === 'meeting' || b.kind === 'travel' || b.taskId === plan.mainTaskId,
  )
}

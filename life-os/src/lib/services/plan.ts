import { prisma } from '@/lib/db'
import { dayBounds, weekDayKeys } from '@/lib/dates'
import { OPEN_TASK_STATUSES, parseJsonObject, type EnergyLevel, type Priority, type TaskContext } from '@/lib/domain/enums'
import {
  planDay,
  planWeek,
  type DayPlan,
  type PlannerConfig,
  type PlannerEvent,
  type PlannerTask,
  type PlannerWorkout,
  type WeekPlan,
} from '@/lib/scheduling/planner'

interface TaskRow {
  id: string
  title: string
  priority: string
  energy: string
  context: string | null
  estimatedMinutes: number
  deadline: Date | null
  deferCount: number
  dependsOnId: string | null
  projectId: string | null
  goalId: string | null
  project: { client: string | null; name: string } | null
  area: { name: string } | null
}

const MEDIA_HINT = /бренд|контент|媒|media|блог|инстаграм/i
const HEALTH_HINT = /здоров|спорт|тело|энерг/i

export function toPlannerTask(row: TaskRow, blockingCount: number, blocked: boolean): PlannerTask {
  const areaName = row.area?.name ?? ''
  return {
    id: row.id,
    title: row.title,
    priority: row.priority as Priority,
    energy: row.energy as EnergyLevel,
    context: (row.context as TaskContext | null) ?? null,
    estimatedMinutes: row.estimatedMinutes,
    deadline: row.deadline,
    deferCount: row.deferCount,
    blocked,
    blockingCount,
    strategicValue: row.goalId ? 0.9 : row.projectId ? 0.6 : 0.3,
    incomeImpact: row.project?.client ? 0.75 : row.projectId ? 0.45 : 0.15,
    mediaImpact: MEDIA_HINT.test(areaName) || row.context === 'creative' ? 0.7 : 0.2,
    healthImpact: HEALTH_HINT.test(areaName) ? 0.75 : 0.15,
  }
}

async function loadTasks(userId: string): Promise<PlannerTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ['inbox', 'clarification', 'planned', 'in_progress'] },
    },
    include: {
      project: { select: { client: true, name: true } },
      area: { select: { name: true } },
    },
    take: 200,
  })

  const blockingCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.dependsOnId) {
      blockingCounts.set(row.dependsOnId, (blockingCounts.get(row.dependsOnId) ?? 0) + 1)
    }
  }
  const openIds = new Set(rows.map((r) => r.id))

  return rows.map((row) =>
    toPlannerTask(
      row as TaskRow,
      blockingCounts.get(row.id) ?? 0,
      Boolean(row.dependsOnId && openIds.has(row.dependsOnId)),
    ),
  )
}

async function loadEvents(userId: string, from: Date, to: Date): Promise<PlannerEvent[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { userId, deletedAt: null, startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: 'asc' },
  })
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    travelMinutes: e.travelMinutes,
    prepMinutes: e.prepMinutes,
    recoveryMinutes: e.recoveryMinutes,
    load: e.hasOtherPeople ? 'high' : 'medium',
  }))
}

async function loadWorkouts(userId: string, from: Date, to: Date): Promise<PlannerWorkout[]> {
  const rows = await prisma.workout.findMany({
    where: { userId, date: { gte: from, lt: to } },
  })
  return rows.map((w) => ({ kind: w.kind, intensity: w.intensity }))
}

async function loadConfig(userId: string): Promise<Partial<PlannerConfig>> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const prefs = parseJsonObject<{ workStartMinute?: number; workEndMinute?: number; maxUtilization?: number }>(
    user.preferences,
    {},
  )
  const config: Partial<PlannerConfig> = {}
  if (typeof prefs.workStartMinute === 'number') config.workStartMinute = prefs.workStartMinute
  if (typeof prefs.workEndMinute === 'number') config.workEndMinute = prefs.workEndMinute
  if (typeof prefs.maxUtilization === 'number') config.maxUtilization = prefs.maxUtilization
  return config
}

export async function buildDayPlan(
  userId: string,
  dateKey: string,
  timezone: string,
  now: Date = new Date(),
): Promise<DayPlan> {
  const { start, end } = dayBounds(dateKey, timezone)
  const [tasks, events, workouts, config] = await Promise.all([
    loadTasks(userId),
    loadEvents(userId, new Date(start.getTime() - 6 * 3_600_000), new Date(end.getTime() + 6 * 3_600_000)),
    loadWorkouts(userId, start, end),
    loadConfig(userId),
  ])
  return planDay({ dateKey, timezone, now, events, tasks, workouts, config })
}

export async function buildWeekPlan(
  userId: string,
  weekStart: string,
  timezone: string,
  now: Date = new Date(),
): Promise<WeekPlan> {
  const dateKeys = weekDayKeys(weekStart)
  const firstKey = dateKeys[0] ?? weekStart
  const lastKey = dateKeys[dateKeys.length - 1] ?? weekStart
  const from = dayBounds(firstKey, timezone).start
  const to = dayBounds(lastKey, timezone).end

  const [tasks, events, workouts, config] = await Promise.all([
    loadTasks(userId),
    loadEvents(userId, from, to),
    loadWorkouts(userId, from, to),
    loadConfig(userId),
  ])

  const eventsByDay: Record<string, PlannerEvent[]> = {}
  const workoutsByDay: Record<string, PlannerWorkout[]> = {}
  for (const dateKey of dateKeys) {
    const bounds = dayBounds(dateKey, timezone)
    eventsByDay[dateKey] = events.filter(
      (e) => e.startsAt >= bounds.start && e.startsAt < bounds.end,
    )
    workoutsByDay[dateKey] = workouts
  }

  return planWeek({ dateKeys, timezone, now, eventsByDay, workoutsByDay, tasks, config })
}

/**
 * Writes the planned focus blocks. Creating internal time blocks is a SAFE
 * action (fully reversible), so it happens without an approval request.
 */
export async function persistDayPlan(
  userId: string,
  plan: DayPlan,
  timezone: string,
): Promise<{ created: number; replaced: number }> {
  const { start, end } = dayBounds(plan.dateKey, timezone)
  const removed = await prisma.timeBlock.updateMany({
    where: { userId, startsAt: { gte: start, lt: end }, locked: false, deletedAt: null },
    data: { deletedAt: new Date(), status: 'replaced' },
  })

  const blocks = plan.blocks.filter((b) => b.kind !== 'meeting')
  for (const block of blocks) {
    await prisma.timeBlock.create({
      data: {
        userId,
        taskId: block.taskId ?? null,
        eventId: block.eventId ?? null,
        title: block.title,
        kind: block.kind,
        load: block.load,
        startsAt: block.start,
        endsAt: block.end,
        score: block.score,
        source: 'planner',
      },
    })
  }

  const plannedTaskIds = plan.blocks.map((b) => b.taskId).filter((id): id is string => Boolean(id))
  if (plannedTaskIds.length > 0) {
    await prisma.task.updateMany({
      where: { userId, id: { in: plannedTaskIds }, status: { in: ['inbox', 'clarification'] } },
      data: { status: 'planned' },
    })
  }

  // Tasks that could not be placed count as deferred once — after three
  // deferrals the planner surfaces them for review instead of moving them again.
  const deferredIds = plan.deferred.map((d) => d.taskId)
  if (deferredIds.length > 0) {
    await prisma.task.updateMany({
      where: { userId, id: { in: deferredIds }, status: { in: OPEN_TASK_STATUSES } },
      data: { deferCount: { increment: 1 } },
    })
  }

  return { created: blocks.length, replaced: removed.count }
}

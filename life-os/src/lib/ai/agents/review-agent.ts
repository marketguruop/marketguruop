import { prisma } from '@/lib/db'
import { minutesBetween, overlaps } from '@/lib/dates'
import { DEFAULT_PLANNER_CONFIG, type DayPlan } from '@/lib/scheduling/planner'
import { findDuplicateGroups } from '@/lib/services/tasks'
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums'

export type Severity = 'info' | 'warning' | 'critical'

export interface ReviewFinding {
  severity: Severity
  title: string
  detail: string
  entityType?: string
  entityId?: string
}

/**
 * Deterministic quality gate. Runs before a plan is shown to the user; it does
 * not need a model and therefore cannot hallucinate a problem.
 */
export async function reviewPlan(
  userId: string,
  plan: DayPlan,
  now: Date = new Date(),
): Promise<ReviewFinding[]> {
  const findings: ReviewFinding[] = []
  const config = DEFAULT_PLANNER_CONFIG

  if (plan.utilization > config.maxUtilization + 1e-9) {
    findings.push({
      severity: 'critical',
      title: 'День перегружен',
      detail: `Занято ${Math.round(plan.utilization * 100)}% свободного времени при лимите ${Math.round(
        config.maxUtilization * 100,
      )}%. Перенеси или делегируй часть задач.`,
    })
  }

  if (plan.freeMinutes < plan.availableMinutes * 0.25 && plan.availableMinutes > 0) {
    findings.push({
      severity: 'warning',
      title: 'Мало резерва',
      detail: `Свободно ${plan.freeMinutes} мин из ${plan.availableMinutes}. Правило: минимум 25% дня остаётся пустым.`,
    })
  }

  for (let i = 0; i < plan.blocks.length; i += 1) {
    for (let j = i + 1; j < plan.blocks.length; j += 1) {
      const a = plan.blocks[i]
      const b = plan.blocks[j]
      if (!a || !b) continue
      if (overlaps(a.start, a.end, b.start, b.end)) {
        findings.push({
          severity: 'critical',
          title: 'Наложение блоков',
          detail: `«${a.title}» и «${b.title}» пересекаются по времени.`,
        })
      }
    }
  }

  const meetings = plan.blocks.filter((b) => b.kind === 'meeting')
  for (let i = 1; i < meetings.length; i += 1) {
    const prev = meetings[i - 1]
    const current = meetings[i]
    if (!prev || !current) continue
    const gap = minutesBetween(prev.end, current.start)
    if (gap >= 0 && gap < config.minGapMinutes) {
      findings.push({
        severity: 'warning',
        title: 'Встречи слишком плотно',
        detail: `Между «${prev.title}» и «${current.title}» всего ${gap} мин. Нужно минимум ${config.minGapMinutes}.`,
      })
    }
  }

  const eventIds = plan.blocks.map((b) => b.eventId).filter((id): id is string => Boolean(id))
  if (eventIds.length > 0) {
    const events = await prisma.calendarEvent.findMany({
      where: { userId, id: { in: eventIds }, deletedAt: null },
      select: { id: true, title: true, location: true, travelMinutes: true },
    })
    for (const event of events) {
      if (event.location && event.travelMinutes === 0) {
        findings.push({
          severity: 'warning',
          title: 'Не заложена дорога',
          detail: `У события «${event.title}» указан адрес, но время на дорогу — 0 минут.`,
          entityType: 'CalendarEvent',
          entityId: event.id,
        })
      }
    }
  }

  const duplicates = await findDuplicateGroups(userId)
  for (const group of duplicates.slice(0, 5)) {
    findings.push({
      severity: 'warning',
      title: 'Похоже на дубль',
      detail: `«${group.keepTitle}» дублируется ${group.duplicates.length} раз(а).`,
      entityType: 'Task',
      entityId: group.keepId,
    })
  }

  for (const deferred of plan.deferred.filter((d) => d.needsReview)) {
    findings.push({
      severity: 'warning',
      title: 'Бесконечный перенос',
      detail: `«${deferred.title}» переносится третий раз и больше. Удалить, делегировать или переформулировать.`,
      entityType: 'Task',
      entityId: deferred.taskId,
    })
  }

  const [openCount, goalLinked] = await Promise.all([
    prisma.task.count({ where: { userId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } } }),
    prisma.task.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES },
        OR: [{ goalId: { not: null } }, { projectId: { not: null } }],
      },
    }),
  ])
  if (openCount > 0 && goalLinked / openCount < 0.4) {
    findings.push({
      severity: 'info',
      title: 'Задачи оторваны от целей',
      detail: `Только ${goalLinked} из ${openCount} открытых задач привязаны к проекту или цели.`,
    })
  }
  if (openCount > 120) {
    findings.push({
      severity: 'warning',
      title: 'Список задач растёт бесконтрольно',
      detail: `${openCount} открытых задач. Нужна ревизия: часть удалить, часть перевести в «когда-нибудь».`,
    })
  }

  const overdue = await prisma.task.count({
    where: {
      userId,
      deletedAt: null,
      status: { in: OPEN_TASK_STATUSES },
      deadline: { lt: now },
    },
  })
  if (overdue > 0) {
    findings.push({
      severity: 'critical',
      title: 'Просроченные дедлайны',
      detail: `${overdue} задач(и) с прошедшим дедлайном.`,
    })
  }

  return findings
}

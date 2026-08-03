import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { callStructured } from '@/lib/ai/client'
import { AGENTS } from '@/lib/ai/registry'
import { SPECIALIST_JSON_SCHEMA, SpecialistSchema, type Proposal, type SpecialistResult } from '@/lib/ai/schemas'
import { buildContextBlock } from '@/lib/ai/memory'
import { chargeRun, finishRun, recordAction, startRun, type RunHandle } from '@/lib/ai/run'
import { createTask, titleSimilarity, DUPLICATE_THRESHOLD } from '@/lib/services/tasks'
import { localDateKey } from '@/lib/dates'
import { checkWorkoutConflict } from '@/lib/scheduling/planner'
import type { AgentKey, Priority } from '@/lib/domain/enums'

const log = logger('agent/specialists')

/** Agents that write to the database through this module. */
export const SPECIALIST_KEYS = ['content', 'finance', 'crm', 'business', 'energy', 'automation'] as const
export type SpecialistKey = (typeof SPECIALIST_KEYS)[number]

export function isSpecialist(key: string): key is SpecialistKey {
  return (SPECIALIST_KEYS as readonly string[]).includes(key)
}

export interface CreatedEntity {
  type: string
  id: string
  title: string
  note?: string
}

export interface SpecialistRunResult {
  agentKey: AgentKey
  agentName: string
  summary: string
  findings: SpecialistResult['findings']
  created: CreatedEntity[]
  skipped: { title: string; reason: string }[]
  usedAi: boolean
  runId: string
}

const DAY = 86_400_000

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY)
}

function daysAhead(days: number): Date {
  return new Date(Date.now() + days * DAY)
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// ---------------------------------------------------------------- deterministic
// These run when no API key is configured and whenever a model call fails.
// Every rule below is a real check against real rows — none of them invent data.

async function contentProposals(userId: string, timezone: string): Promise<SpecialistResult> {
  const [events, orphanIdeas, recentPublications] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId, deletedAt: null, startsAt: { gte: new Date(), lt: daysAhead(14) } },
      orderBy: { startsAt: 'asc' },
      take: 8,
    }),
    prisma.contentIdea.findMany({
      where: { userId, deletedAt: null, items: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.publication.count({
      where: { userId, deletedAt: null, publishedAt: { gte: daysAgo(14) } },
    }),
  ])

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []

  // Real life first: an event on the calendar is material that already exists.
  for (const event of events.slice(0, 3)) {
    proposals.push({
      kind: 'content_idea',
      title: `Закулисье: ${event.title}`,
      detail: event.location ? `Место: ${event.location}` : null,
      reason: `Событие ${localDateKey(event.startsAt, timezone)} уже в календаре — снимать нечего дополнительно организовывать.`,
      priority: 'medium',
      estimatedMinutes: 45,
      platform: 'reels',
      hook: null,
      confidence: 0.5,
    })
  }

  // An idea with no material attached is where content pipelines stall.
  for (const idea of orphanIdeas.slice(0, 2)) {
    proposals.push({
      kind: 'content_item',
      title: idea.title,
      detail: idea.hook,
      reason: 'Идея есть, но нет материала — без сценария и даты съёмки она не доедет до публикации.',
      priority: 'medium',
      estimatedMinutes: 60,
      platform: 'instagram',
      hook: idea.hook,
      script: null,
      shootAt: null,
      publishAt: null,
      confidence: 0.55,
    })
  }

  if (recentPublications === 0) {
    findings.push({
      title: 'Две недели без публикаций',
      detail: 'За последние 14 дней нет ни одной публикации. Регулярность важнее объёма.',
      severity: 'warning',
    })
  }

  return {
    summary: `Разбор без AI: событий впереди ${events.length}, идей без материала ${orphanIdeas.length}.`,
    findings,
    proposals,
  }
}

async function financeProposals(userId: string, timezone: string): Promise<SpecialistResult> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [overdue, unpaid, lateIncome, subscriptions, received, goal] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, deletedAt: null, status: 'unpaid', dueAt: { lt: now } },
      take: 10,
    }),
    prisma.invoice.count({ where: { userId, deletedAt: null, status: 'unpaid' } }),
    prisma.income.findMany({
      where: { userId, deletedAt: null, status: 'expected', expectedAt: { lt: now } },
      take: 10,
    }),
    prisma.expense.findMany({ where: { userId, deletedAt: null, isSubscription: true }, take: 20 }),
    prisma.income.findMany({
      where: { userId, deletedAt: null, status: 'received', receivedAt: { gte: monthStart } },
      select: { amount: true },
    }),
    prisma.goal.findFirst({
      where: { userId, deletedAt: null, metric: 'income_eur_month' },
      select: { targetValue: true },
    }),
  ])

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []

  for (const invoice of overdue) {
    proposals.push({
      kind: 'task',
      title: `Напомнить об оплате: ${invoice.counterparty}`,
      detail: `Счёт ${invoice.number ?? 'без номера'} на ${invoice.amount} ${invoice.currency}, срок был ${
        invoice.dueAt ? localDateKey(invoice.dueAt, timezone) : 'не указан'
      }.`,
      reason: 'Счёт просрочен — деньги не придут, пока не напомнишь.',
      priority: 'high',
      estimatedMinutes: 15,
      confidence: 0.9,
    })
  }

  for (const income of lateIncome) {
    proposals.push({
      kind: 'task',
      title: `Проверить поступление: ${income.title}`,
      detail: `Ожидалось ${income.expectedAt ? localDateKey(income.expectedAt, timezone) : '—'}, сумма ${income.amount} ${income.currency}.`,
      reason: 'Дата ожидаемого поступления прошла, статус до сих пор «ожидается».',
      priority: 'high',
      estimatedMinutes: 15,
      confidence: 0.85,
    })
  }

  const monthIncome = received.reduce((sum, i) => sum + i.amount, 0)
  const target = goal?.targetValue ?? 0
  if (target > 0 && monthIncome < target) {
    findings.push({
      title: 'Цель месяца не закрыта',
      detail: `Получено ${Math.round(monthIncome)} из ${Math.round(target)}. Не хватает ${Math.round(target - monthIncome)}.`,
      severity: monthIncome < target * 0.5 ? 'warning' : 'info',
    })
  }

  if (subscriptions.length > 0) {
    const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
    findings.push({
      title: 'Подписки',
      detail: `${subscriptions.length} шт. на ${Math.round(total)} в месяц: ${subscriptions
        .map((s) => s.title)
        .join(', ')}. Проверь, чем из этого пользуешься.`,
      severity: 'info',
    })
  }

  if (unpaid > 0) {
    findings.push({
      title: 'Неоплаченные счета',
      detail: `Всего ${unpaid}, из них просрочено ${overdue.length}.`,
      severity: overdue.length > 0 ? 'warning' : 'info',
    })
  }

  return {
    summary: `Разбор без AI: просроченных счетов ${overdue.length}, зависших поступлений ${lateIncome.length}.`,
    findings,
    proposals,
  }
}

async function crmProposals(userId: string, timezone: string): Promise<SpecialistResult> {
  const now = new Date()
  const [overdueFollowUps, coldContacts] = await Promise.all([
    prisma.followUp.findMany({
      where: { userId, deletedAt: null, status: 'open', dueAt: { lt: now } },
      include: { contact: { select: { name: true } } },
      take: 10,
    }),
    prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'active',
        OR: [{ lastContactAt: { lt: daysAgo(45) } }, { lastContactAt: null }],
        projects: { some: {} },
      },
      take: 6,
    }),
  ])

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []

  for (const followUp of overdueFollowUps) {
    proposals.push({
      kind: 'task',
      title: `Ответить: ${followUp.contact.name} — ${followUp.subject}`,
      detail: followUp.agreement,
      reason: `Договорённость просрочена с ${followUp.dueAt ? localDateKey(followUp.dueAt, timezone) : '—'}.`,
      priority: 'high',
      estimatedMinutes: 15,
      contactName: followUp.contact.name,
      confidence: 0.9,
    })
  }

  for (const contact of coldContacts) {
    proposals.push({
      kind: 'follow_up',
      title: `Напомнить о себе: ${contact.name}`,
      detail: contact.notes,
      reason: contact.lastContactAt
        ? `Последний контакт ${localDateKey(contact.lastContactAt, timezone)} — больше 45 дней назад.`
        : 'Контакт связан с проектом, но общения не было ни разу.',
      priority: 'low',
      estimatedMinutes: 10,
      contactName: contact.name,
      dueAt: daysAhead(3).toISOString(),
      confidence: 0.5,
    })
  }

  if (overdueFollowUps.length > 0) {
    findings.push({
      title: 'Просроченные договорённости',
      detail: `${overdueFollowUps.length} шт. Каждая — обещание, которое ты дала и не закрыла.`,
      severity: 'warning',
    })
  }

  return {
    summary: `Разбор без AI: просрочено follow-up ${overdueFollowUps.length}, остывших контактов ${coldContacts.length}.`,
    findings,
    proposals,
  }
}

async function businessProposals(userId: string, timezone: string): Promise<SpecialistResult> {
  const projects = await prisma.project.findMany({
    where: { userId, deletedAt: null, status: 'active' },
    include: { _count: { select: { tasks: true } } },
    take: 20,
  })
  const waiting = await prisma.task.findMany({
    where: { userId, deletedAt: null, status: { in: ['waiting', 'delegated'] }, updatedAt: { lt: daysAgo(5) } },
    take: 10,
  })

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []

  for (const project of projects) {
    if (!project.nextAction) {
      proposals.push({
        kind: 'project_update',
        title: project.name,
        detail: null,
        reason: 'У проекта не задан следующий шаг — он встанет в тот момент, когда ты о нём забудешь.',
        priority: 'high',
        estimatedMinutes: 15,
        projectName: project.name,
        confidence: 0.8,
      })
    }
    if (project.deadline && project.deadline < daysAhead(14) && project.progress < 0.7) {
      findings.push({
        title: `Риск по срокам: ${project.name}`,
        detail: `Дедлайн ${localDateKey(project.deadline, timezone)}, прогресс ${Math.round(
          project.progress * 100,
        )}%, задач ${project._count.tasks}.`,
        severity: 'critical',
      })
      proposals.push({
        kind: 'task',
        title: `Пересобрать план: ${project.name}`,
        detail: `Дедлайн через ${Math.ceil((project.deadline.getTime() - Date.now()) / DAY)} дн. при прогрессе ${Math.round(project.progress * 100)}%.`,
        reason: 'Темп не выводит на срок — нужно сократить объём, добавить ресурс или двигать дату.',
        priority: 'critical',
        estimatedMinutes: 45,
        projectName: project.name,
        confidence: 0.85,
      })
    }
  }

  for (const task of waiting) {
    findings.push({
      title: 'Ждём чужого ответа',
      detail: `«${task.title}» — ждём ${task.waitingOn ?? task.delegatedTo ?? 'кого-то'} больше 5 дней.`,
      severity: 'warning',
    })
  }

  return {
    summary: `Разбор без AI: проектов ${projects.length}, без следующего шага ${
      projects.filter((p) => !p.nextAction).length
    }.`,
    findings,
    proposals,
  }
}

async function energyProposals(userId: string, timezone: string): Promise<SpecialistResult> {
  const [sleep, energy, workouts, habits] = await Promise.all([
    prisma.sleepLog.findMany({ where: { userId, date: { gte: daysAgo(14) } }, orderBy: { date: 'desc' } }),
    prisma.energyLog.findMany({ where: { userId, date: { gte: daysAgo(14) } }, orderBy: { date: 'desc' } }),
    prisma.workout.findMany({ where: { userId, date: { gte: daysAgo(7), lt: daysAhead(7) } } }),
    prisma.habit.findMany({
      where: { userId, deletedAt: null, status: 'active' },
      include: { logs: { where: { date: { gte: daysAgo(14) } } } },
    }),
  ])

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []

  const avgSleep = sleep.length > 0 ? sleep.reduce((s, l) => s + l.hours, 0) / sleep.length : 0
  const avgEnergy = energy.length > 0 ? energy.reduce((s, e) => s + e.level, 0) / energy.length : 0
  const shortNights = sleep.filter((l) => l.hours < 6.5).length

  if (sleep.length >= 3 && avgSleep < 7) {
    findings.push({
      title: 'Сон ниже семи часов',
      detail: `Средний сон ${avgSleep.toFixed(1)} ч за ${sleep.length} дн., ночей меньше 6.5 ч — ${shortNights}. Это наблюдение по твоим записям, не медицинский вывод.`,
      severity: shortNights >= 4 ? 'warning' : 'info',
    })
  }
  if (energy.length >= 3 && avgEnergy < 3) {
    findings.push({
      title: 'Энергия ниже средней',
      detail: `Средний уровень ${avgEnergy.toFixed(1)} из 5. Посмотри, что предшествовало провалам — это журнал состояния, а не диагноз.`,
      severity: 'warning',
    })
    proposals.push({
      kind: 'note',
      title: 'Минимальная версия дня',
      detail: 'При энергии 1–2 оставляй только встречи и одну главную задачу. Остальное переносится без чувства вины.',
      reason: `Средняя энергия за две недели ${avgEnergy.toFixed(1)} из 5.`,
      priority: 'medium',
      estimatedMinutes: 5,
      confidence: 0.7,
    })
  }

  // Group by local day so the run/strength rule is checked per calendar day.
  const byDay = new Map<string, { kind: string; intensity: string }[]>()
  for (const workout of workouts) {
    const key = localDateKey(workout.date, timezone)
    byDay.set(key, [...(byDay.get(key) ?? []), { kind: workout.kind, intensity: workout.intensity }])
  }
  for (const [day, list] of byDay) {
    const conflict = checkWorkoutConflict(list)
    if (conflict) {
      findings.push({ title: `Конфликт тренировок ${day}`, detail: conflict, severity: 'warning' })
      proposals.push({
        kind: 'task',
        title: `Перенести одну тренировку с ${day}`,
        detail: conflict,
        reason: 'Бег и тяжёлая силовая в один день не дают восстановиться.',
        priority: 'medium',
        estimatedMinutes: 10,
        confidence: 0.9,
      })
    }
  }

  for (const habit of habits) {
    const done = habit.logs.filter((l) => l.done).length
    const expected = habit.targetPerWeek * 2
    if (expected > 0 && done / expected < 0.5) {
      findings.push({
        title: `Привычка буксует: ${habit.name}`,
        detail: `${done} из ${expected} за две недели. Возможно, цель завышена.`,
        severity: 'info',
      })
    }
  }

  return {
    summary: `Разбор без AI: записей сна ${sleep.length}, энергии ${energy.length}, тренировок ${workouts.length}.`,
    findings,
    proposals,
  }
}

async function automationProposals(userId: string): Promise<SpecialistResult> {
  const [automatable, existing] = await Promise.all([
    prisma.task.findMany({
      where: { userId, deletedAt: null, canAutomate: true },
      select: { title: true, estimatedMinutes: true, context: true },
      take: 30,
    }),
    prisma.automation.findMany({ where: { userId, deletedAt: null }, take: 20 }),
  ])

  const proposals: Proposal[] = []
  const findings: SpecialistResult['findings'] = []
  const existingNames = existing.map((a) => a.name)

  for (const task of automatable) {
    if (existingNames.some((name) => titleSimilarity(name, task.title) >= DUPLICATE_THRESHOLD)) continue
    // Weekly cadence is the conservative assumption: one repeat per week.
    const saved = Math.min(600, task.estimatedMinutes)
    proposals.push({
      kind: 'automation',
      title: `Автоматизировать: ${task.title}`,
      detail: `Триггер: расписание. Действие: создать черновик и напомнить. Данные: только внутренние записи системы.`,
      reason: `Задача помечена как автоматизируемая, оценка ${task.estimatedMinutes} мин.`,
      priority: 'low',
      estimatedMinutes: 30,
      savedMinutesPerWeek: saved,
      confidence: 0.5,
    })
  }

  const drafts = existing.filter((a) => !a.enabled)
  if (drafts.length > 0) {
    findings.push({
      title: 'Черновики автоматизаций',
      detail: `${drafts.length} шт. не включены: ${drafts.map((d) => d.name).join(', ')}. Включение требует подтверждения.`,
      severity: 'info',
    })
  }
  const broken = existing.filter((a) => a.errorCount > 0)
  if (broken.length > 0) {
    findings.push({
      title: 'Автоматизации с ошибками',
      detail: broken.map((b) => `${b.name}: ${b.lastError ?? 'ошибка'}`).join('; '),
      severity: 'warning',
    })
  }

  return {
    summary: `Разбор без AI: кандидатов на автоматизацию ${proposals.length}, существующих сценариев ${existing.length}.`,
    findings,
    proposals,
  }
}

async function deterministicProposals(
  userId: string,
  agentKey: SpecialistKey,
  timezone: string,
): Promise<SpecialistResult> {
  switch (agentKey) {
    case 'content':
      return contentProposals(userId, timezone)
    case 'finance':
      return financeProposals(userId, timezone)
    case 'crm':
      return crmProposals(userId, timezone)
    case 'business':
      return businessProposals(userId, timezone)
    case 'energy':
      return energyProposals(userId, timezone)
    case 'automation':
      return automationProposals(userId)
  }
}

/** Compact view of the agent's own domain, handed to the model as context. */
async function domainSnapshot(userId: string, agentKey: SpecialistKey): Promise<string> {
  const deterministic = await deterministicProposals(userId, agentKey, 'UTC')
  const findings = deterministic.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`)
  return [
    deterministic.summary,
    findings.length > 0 ? findings.join('\n') : '- (детерминированных находок нет)',
  ].join('\n')
}

// ---------------------------------------------------------------- materialising

async function resolveProjectId(userId: string, name: string | null | undefined): Promise<string | null> {
  if (!name) return null
  const project = await prisma.project.findFirst({
    where: { userId, deletedAt: null, name: { contains: name } },
    select: { id: true },
  })
  return project?.id ?? null
}

async function resolveContactId(userId: string, name: string | null | undefined): Promise<string | null> {
  if (!name) return null
  const contact = await prisma.contact.findFirst({
    where: { userId, deletedAt: null, name: { contains: name } },
    select: { id: true },
  })
  return contact?.id ?? null
}

type MaterializeOutcome =
  | { kind: 'created'; entity: CreatedEntity }
  | { kind: 'skipped'; skip: { title: string; reason: string } }

/**
 * Turns one proposal into a row. Everything written here is internal and
 * reversible — drafts, tasks, notes. Outward-facing steps (publishing,
 * sending, switching an automation on) stay behind the Approval Center.
 */
async function materialize(
  handle: RunHandle,
  userId: string,
  proposal: Proposal,
): Promise<MaterializeOutcome> {
  const priority = proposal.priority as Priority

  switch (proposal.kind) {
    case 'task': {
      const projectId = await resolveProjectId(userId, proposal.projectName)
      const task = await createTask({
        userId,
        title: proposal.title,
        description: proposal.detail ?? null,
        nextAction: proposal.reason,
        projectId,
        priority,
        estimatedMinutes: proposal.estimatedMinutes,
        deadline: safeDate(proposal.dueAt),
        source: 'agent',
        confidence: proposal.confidence,
      })
      await recordAction(handle, {
        kind: 'create_task',
        entityType: 'Task',
        entityId: task.id,
        status: task.created ? 'applied' : 'skipped',
        reason: task.created ? proposal.reason : 'Найден дубль',
      })
      return task.created
        ? { kind: 'created', entity: { type: 'Задача', id: task.id, title: proposal.title } }
        : { kind: 'skipped', skip: { title: proposal.title, reason: 'Такая задача уже есть' } }
    }

    case 'content_idea': {
      const existing = await prisma.contentIdea.findMany({
        where: { userId, deletedAt: null },
        select: { title: true },
        take: 200,
      })
      if (existing.some((e) => titleSimilarity(e.title, proposal.title) >= DUPLICATE_THRESHOLD)) {
        return { kind: 'skipped', skip: { title: proposal.title, reason: 'Такая идея уже есть' } }
      }
      const idea = await prisma.contentIdea.create({
        data: {
          userId,
          projectId: await resolveProjectId(userId, proposal.projectName),
          title: proposal.title,
          hook: proposal.hook ?? null,
          angle: proposal.detail ?? null,
          platforms: JSON.stringify(proposal.platform ? [proposal.platform] : ['instagram']),
          priority,
          source: 'agent',
          confidence: proposal.confidence,
        },
      })
      await recordAction(handle, {
        kind: 'create_idea',
        entityType: 'ContentIdea',
        entityId: idea.id,
        reason: proposal.reason,
      })
      return { kind: 'created', entity: { type: 'Идея для контента', id: idea.id, title: idea.title } }
    }

    case 'content_item': {
      const idea = await prisma.contentIdea.findFirst({
        where: { userId, deletedAt: null, title: { contains: proposal.title } },
        select: { id: true },
      })
      const item = await prisma.contentItem.create({
        data: {
          userId,
          ideaId: idea?.id ?? null,
          title: proposal.title,
          platform: proposal.platform ?? 'instagram',
          format: proposal.platform === 'youtube' ? 'video' : 'reels',
          script: proposal.script ?? null,
          shotList: JSON.stringify(proposal.shotList ?? []),
          caption: proposal.hook ?? null,
          shootAt: safeDate(proposal.shootAt),
          publishAt: safeDate(proposal.publishAt),
          status: 'planned',
          source: 'agent',
          confidence: proposal.confidence,
        },
      })
      await recordAction(handle, {
        kind: 'create_draft',
        entityType: 'ContentItem',
        entityId: item.id,
        reason: proposal.reason,
      })
      return {
        kind: 'created',
        entity: {
          type: 'Материал',
          id: item.id,
          title: item.title,
          note: 'Черновик — публикация только после подтверждения',
        },
      }
    }

    case 'follow_up': {
      const contactId = await resolveContactId(userId, proposal.contactName)
      if (!contactId) {
        return {
          kind: 'skipped',
          skip: { title: proposal.title, reason: `Контакт «${proposal.contactName ?? '—'}» не найден` },
        }
      }
      const duplicate = await prisma.followUp.findFirst({
        where: { userId, contactId, status: 'open', deletedAt: null, subject: { contains: proposal.title } },
        select: { id: true },
      })
      if (duplicate) {
        return { kind: 'skipped', skip: { title: proposal.title, reason: 'Такой follow-up уже открыт' } }
      }
      const followUp = await prisma.followUp.create({
        data: {
          userId,
          contactId,
          subject: proposal.title,
          agreement: proposal.detail ?? null,
          draftMessage: proposal.script ?? null,
          dueAt: safeDate(proposal.dueAt),
          source: 'agent',
          confidence: proposal.confidence,
        },
      })
      await recordAction(handle, {
        kind: 'create_draft',
        entityType: 'FollowUp',
        entityId: followUp.id,
        reason: proposal.reason,
      })
      return {
        kind: 'created',
        entity: {
          type: 'Follow-up',
          id: followUp.id,
          title: proposal.title,
          note: 'Сообщение не отправляется без подтверждения',
        },
      }
    }

    case 'automation': {
      const existing = await prisma.automation.findMany({
        where: { userId, deletedAt: null },
        select: { name: true },
        take: 100,
      })
      if (existing.some((e) => titleSimilarity(e.name, proposal.title) >= DUPLICATE_THRESHOLD)) {
        return { kind: 'skipped', skip: { title: proposal.title, reason: 'Такой сценарий уже описан' } }
      }
      const automation = await prisma.automation.create({
        data: {
          userId,
          name: proposal.title,
          description: proposal.detail ?? proposal.reason,
          trigger: 'schedule',
          triggerConfig: JSON.stringify({ cron: '0 9 * * 1' }),
          actions: JSON.stringify([{ kind: 'create_task', title: proposal.title }]),
          savedMinutesPerWeek: proposal.savedMinutesPerWeek ?? 0,
          riskLevel: 'low',
          enabled: false,
          status: 'draft',
          source: 'agent',
        },
      })
      await recordAction(handle, {
        kind: 'create_draft',
        entityType: 'Automation',
        entityId: automation.id,
        reason: proposal.reason,
      })
      return {
        kind: 'created',
        entity: {
          type: 'Сценарий автоматизации',
          id: automation.id,
          title: automation.name,
          note: 'Черновик — включение требует подтверждения',
        },
      }
    }

    case 'project_update': {
      const projectId = await resolveProjectId(userId, proposal.projectName ?? proposal.title)
      if (!projectId) {
        return { kind: 'skipped', skip: { title: proposal.title, reason: 'Проект не найден' } }
      }
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      // Never overwrite a next step the user already wrote — propose a task instead.
      if (project.nextAction) {
        const task = await createTask({
          userId,
          title: `Пересмотреть следующий шаг: ${project.name}`,
          description: proposal.detail ?? proposal.reason,
          projectId,
          priority,
          estimatedMinutes: proposal.estimatedMinutes,
          source: 'agent',
          confidence: proposal.confidence,
        })
        return task.created
          ? { kind: 'created', entity: { type: 'Задача', id: task.id, title: `Пересмотреть шаг: ${project.name}` } }
          : { kind: 'skipped', skip: { title: proposal.title, reason: 'Такая задача уже есть' } }
      }
      const nextAction = proposal.detail ?? `Определить следующий шаг по проекту «${project.name}»`
      await prisma.project.update({ where: { id: projectId }, data: { nextAction } })
      await recordAction(handle, {
        kind: 'update_task',
        entityType: 'Project',
        entityId: projectId,
        reason: proposal.reason,
      })
      return {
        kind: 'created',
        entity: { type: 'Проект обновлён', id: projectId, title: `${project.name}: ${nextAction}` },
      }
    }

    case 'note': {
      const note = await prisma.note.create({
        data: {
          userId,
          title: proposal.title,
          body: proposal.detail ?? proposal.reason,
          source: 'agent',
          confidence: proposal.confidence,
        },
      })
      await recordAction(handle, {
        kind: 'create_note',
        entityType: 'Note',
        entityId: note.id,
        reason: proposal.reason,
      })
      return { kind: 'created', entity: { type: 'Заметка', id: note.id, title: note.title } }
    }
  }
}

// ---------------------------------------------------------------------- runner

export async function runSpecialist(
  userId: string,
  agentKey: SpecialistKey,
  timezone: string,
  question: string,
): Promise<SpecialistRunResult> {
  const definition = AGENTS[agentKey]
  const run = await startRun({ userId, agentKey, trigger: 'manual', input: question })

  let result: SpecialistResult
  let usedAi = false
  let inputTokens = 0
  let outputTokens = 0
  let aiError: string | undefined

  try {
    const [context, domain] = await Promise.all([
      buildContextBlock(userId, timezone, question),
      domainSnapshot(userId, agentKey),
    ])
    const response = await callStructured({
      system: definition.systemPrompt,
      jsonSchema: SPECIALIST_JSON_SCHEMA,
      parser: SpecialistSchema,
      maxTokens: 6000,
      prompt: [
        `Текущее время: ${new Date().toISOString()} (часовой пояс ${timezone}).`,
        '',
        'Контекст пользователя:',
        context,
        '',
        'Данные по твоей зоне ответственности:',
        domain,
        '',
        `Запрос: ${question}`,
        '',
        'Предложи конкретные записи. Опирайся только на переданные данные:',
        'не выдумывай проекты, людей, суммы и даты, которых здесь нет.',
        'projectName и contactName указывай только если такое имя встречается в контексте.',
      ].join('\n'),
    })
    result = response.data
    usedAi = true
    inputTokens = response.inputTokens
    outputTokens = response.outputTokens
    chargeRun(run, response.costUsd)
  } catch (error) {
    log.warn('specialist fallback', { agentKey, error: String(error) })
    aiError = String(error)
    result = await deterministicProposals(userId, agentKey, timezone)
  }

  const created: CreatedEntity[] = []
  const skipped: { title: string; reason: string }[] = []

  try {
    for (const proposal of result.proposals) {
      const outcome = await materialize(run, userId, proposal)
      if (outcome.kind === 'created') created.push(outcome.entity)
      else skipped.push(outcome.skip)
    }

    await finishRun(run, {
      status: 'succeeded',
      output: JSON.stringify({ summary: result.summary, created, skipped }),
      inputTokens,
      outputTokens,
      // Recorded even though the run succeeded: the fallback is silent otherwise.
      error: aiError,
    })
  } catch (error) {
    await finishRun(run, { status: 'failed', error: String(error) })
    throw error
  }

  return {
    agentKey,
    agentName: definition.name,
    summary: result.summary,
    findings: result.findings,
    created,
    skipped,
    usedAi,
    runId: run.id,
  }
}

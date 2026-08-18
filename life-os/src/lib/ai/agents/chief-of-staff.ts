import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { callStructured } from '@/lib/ai/client'
import { AGENTS } from '@/lib/ai/registry'
import { BRIEF_JSON_SCHEMA, BriefSchema, type BriefResult } from '@/lib/ai/schemas'
import { buildContextBlock } from '@/lib/ai/memory'
import { chargeRun, finishRun, recordAction, startRun } from '@/lib/ai/run'
import { reviewPlan, type ReviewFinding } from '@/lib/ai/agents/review-agent'
import { buildDayPlan } from '@/lib/services/plan'
import { localTimeLabel, formatRuDateKey } from '@/lib/dates'
import type { DayPlan } from '@/lib/scheduling/planner'

const log = logger('agent/chief')

export interface DailyBrief {
  dateKey: string
  plan: DayPlan
  findings: ReviewFinding[]
  brief: BriefResult
  usedAi: boolean
  runId: string
}

function fallbackBrief(plan: DayPlan, findings: ReviewFinding[]): BriefResult {
  const mainBlock = plan.blocks.find((b) => b.taskId && b.taskId === plan.mainTaskId)
  const critical = findings.filter((f) => f.severity === 'critical')
  return {
    headline: `${formatRuDateKey(plan.dateKey)}: ${plan.blocks.filter((b) => b.taskId).length} задач, загрузка ${Math.round(
      plan.utilization * 100,
    )}%`,
    mainGoal: mainBlock?.title ?? 'Главная задача не определена — выбери её сама.',
    outcomes: plan.outcomes,
    risks: [...critical.map((f) => `${f.title}: ${f.detail}`), ...plan.warnings].slice(0, 5),
    recommendations: plan.deferred.slice(0, 3).map((d) => ({
      action: d.needsReview ? ('drop' as const) : ('defer' as const),
      subject: d.title,
      why: d.reason,
    })),
    closingNote: 'Сводка построена без AI: ANTHROPIC_API_KEY не настроен или запрос не удался.',
  }
}

function describePlan(plan: DayPlan, timezone: string): string {
  const lines = plan.blocks.map(
    (b) =>
      `${localTimeLabel(b.start, timezone)}–${localTimeLabel(b.end, timezone)} [${b.kind}] ${b.title}`,
  )
  return lines.length > 0 ? lines.join('\n') : '(расписание пустое)'
}

export async function buildDailyBrief(
  userId: string,
  dateKey: string,
  timezone: string,
  now: Date = new Date(),
): Promise<DailyBrief> {
  const plan = await buildDayPlan(userId, dateKey, timezone, now)
  const findings = await reviewPlan(userId, plan, now)

  const run = await startRun({
    userId,
    agentKey: 'chief_of_staff',
    trigger: 'manual',
    input: `Брифинг на ${dateKey}`,
  })

  try {
    const context = await buildContextBlock(userId, timezone, `план дня ${dateKey}`)
    const response = await callStructured({
      system: AGENTS.chief_of_staff.systemPrompt,
      jsonSchema: BRIEF_JSON_SCHEMA,
      parser: BriefSchema,
      maxTokens: 4000,
      prompt: [
        `Дата: ${dateKey}. Часовой пояс: ${timezone}.`,
        '',
        'Контекст:',
        context,
        '',
        'Расписание, построенное планировщиком:',
        describePlan(plan, timezone),
        '',
        `Загрузка: ${Math.round(plan.utilization * 100)}% (лимит 75%). Свободно ${plan.freeMinutes} мин.`,
        '',
        'Не поместилось:',
        plan.deferred.length > 0
          ? plan.deferred.map((d) => `- ${d.title} (${d.reason})`).join('\n')
          : '- (всё поместилось)',
        '',
        'Находки проверяющего агента:',
        findings.length > 0
          ? findings.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')
          : '- (проблем не найдено)',
        '',
        'Собери короткую сводку: главная задача дня, максимум три результата, риски и рекомендации.',
      ].join('\n'),
    })
    chargeRun(run, response.costUsd)
    await recordAction(run, { kind: 'build_plan', entityType: 'DayPlan', entityId: dateKey })
    await finishRun(run, {
      status: 'succeeded',
      output: JSON.stringify(response.data),
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    })
    return { dateKey, plan, findings, brief: response.data, usedAi: true, runId: run.id }
  } catch (error) {
    log.warn('brief fallback', { error: String(error) })
    const brief = fallbackBrief(plan, findings)
    await recordAction(run, {
      kind: 'build_plan',
      entityType: 'DayPlan',
      entityId: dateKey,
      reason: 'Сводка без AI',
    })
    await finishRun(run, { status: 'succeeded', output: JSON.stringify(brief), error: String(error) })
    return { dateKey, plan, findings, brief, usedAi: false, runId: run.id }
  }
}

export interface DashboardSnapshot {
  openTasks: number
  overdue: number
  todayEvents: number
  pendingApprovals: number
  inboxPending: number
  waitingOn: number
  monthIncome: number
  monthGoal: number
  unpaidInvoices: number
  contentThisWeek: number
}

export async function loadDashboardSnapshot(
  userId: string,
  monthStart: Date,
  todayStart: Date,
  todayEnd: Date,
): Promise<DashboardSnapshot> {
  const [
    openTasks,
    overdue,
    todayEvents,
    pendingApprovals,
    inboxPending,
    waitingOn,
    incomes,
    unpaidInvoices,
    contentThisWeek,
    goal,
  ] = await Promise.all([
    prisma.task.count({
      where: { userId, deletedAt: null, status: { in: ['inbox', 'clarification', 'planned', 'in_progress'] } },
    }),
    prisma.task.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: ['inbox', 'clarification', 'planned', 'in_progress'] },
        deadline: { lt: new Date() },
      },
    }),
    prisma.calendarEvent.count({
      where: { userId, deletedAt: null, startsAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.approvalRequest.count({ where: { userId, status: 'pending' } }),
    prisma.inboxItem.count({ where: { userId, status: 'pending' } }),
    prisma.task.count({ where: { userId, deletedAt: null, status: { in: ['waiting', 'delegated'] } } }),
    prisma.income.findMany({
      where: { userId, deletedAt: null, status: 'received', receivedAt: { gte: monthStart } },
      select: { amount: true },
    }),
    prisma.invoice.count({ where: { userId, deletedAt: null, status: 'unpaid' } }),
    prisma.contentItem.count({
      where: { userId, deletedAt: null, status: { in: ['planned', 'scripted', 'shot'] } },
    }),
    prisma.goal.findFirst({
      where: { userId, deletedAt: null, status: 'active', metric: 'income_eur_month' },
      select: { targetValue: true },
    }),
  ])

  return {
    openTasks,
    overdue,
    todayEvents,
    pendingApprovals,
    inboxPending,
    waitingOn,
    monthIncome: incomes.reduce((sum, i) => sum + i.amount, 0),
    monthGoal: goal?.targetValue ?? 0,
    unpaidInvoices,
    contentThisWeek,
  }
}

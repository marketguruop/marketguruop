import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { callStructured } from '@/lib/ai/client'
import { AGENTS } from '@/lib/ai/registry'
import { ADVISORY_JSON_SCHEMA, AdvisorySchema, type AdvisoryResult } from '@/lib/ai/schemas'
import { buildContextBlock } from '@/lib/ai/memory'
import { chargeRun, finishRun, recordAction, startRun } from '@/lib/ai/run'
import { buildDailyBrief } from '@/lib/ai/agents/chief-of-staff'
import { captureAndProcess } from '@/lib/ai/agents/inbox-agent'
import { findDuplicateGroups, findStalledTasks } from '@/lib/services/tasks'
import { localDateKey } from '@/lib/dates'
import type { AgentKey } from '@/lib/domain/enums'

const log = logger('orchestrator')

/**
 * The Chief of Staff decides which specialised agent handles a request.
 * Routing is deterministic keyword matching rather than a model call: it is
 * instant, free, and cannot hallucinate a destination.
 */
/** `\b` is ASCII-only in JS, so Cyrillic keywords need a Unicode lookbehind. */
function keywords(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})`, 'iu')
}

// Specialists are matched first; the Chief of Staff is the planning fallback,
// otherwise "контент на неделю" would be routed on the word "неделю".
const ROUTES: { agent: AgentKey; test: RegExp }[] = [
  { agent: 'content', test: keywords('контент|reels?|рилс|сторис|тикток|youtube|съ[её]мк|публикац') },
  { agent: 'finance', test: keywords('деньги|доход|заработа|расход|сч[её]т|инвойс|бюджет|подписк') },
  { agent: 'crm', test: keywords('контакт|follow.?up|договор[её]нност|кому\\s+нужно\\s+ответить') },
  { agent: 'energy', test: keywords('сон|сна|энерги|устал|тренировк|восстановлен') },
  { agent: 'business', test: keywords('проект|клиент|команд|отч[её]т|бренд\\s?бук|стратеги') },
  { agent: 'automation', test: keywords('автоматизир|автоматизац|рутин|повторяет|zapier|make|webhook') },
  { agent: 'task', test: keywords('задач|дубл|зависш|делегир') },
  { agent: 'chief_of_staff', test: keywords('план\\s+дня|план\\s+на\\s+день|брифинг|итог\\s+дня|недел[юияе]|приоритет|что\\s+сегодня') },
]

export function selectAgent(input: string): AgentKey {
  for (const route of ROUTES) {
    if (route.test.test(input)) return route.agent
  }
  // Anything that is not a recognised question is treated as raw capture.
  return 'inbox'
}

export interface OrchestratorResult {
  agentKey: AgentKey
  agentName: string
  text: string
  data?: unknown
  usedAi: boolean
}

export async function runAdvisory(
  userId: string,
  agentKey: AgentKey,
  timezone: string,
  question: string,
): Promise<{ result: AdvisoryResult; usedAi: boolean; runId: string }> {
  const definition = AGENTS[agentKey]
  const run = await startRun({ userId, agentKey, trigger: 'manual', input: question })

  try {
    const context = await buildContextBlock(userId, timezone, question)
    const domain = await loadDomainSnapshot(userId, agentKey)
    const response = await callStructured({
      system: definition.systemPrompt,
      jsonSchema: ADVISORY_JSON_SCHEMA,
      parser: AdvisorySchema,
      maxTokens: 4000,
      prompt: [
        'Контекст пользователя:',
        context,
        '',
        'Данные по твоей зоне ответственности:',
        domain,
        '',
        `Запрос: ${question}`,
        '',
        'Дай короткий разбор и предложи задачи. Ничего не создавай сам.',
      ].join('\n'),
    })
    chargeRun(run, response.costUsd)
    await recordAction(run, { kind: 'analyze_text', reason: 'Аналитический отчёт' })
    await finishRun(run, {
      status: 'succeeded',
      output: JSON.stringify(response.data),
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    })
    return { result: response.data, usedAi: true, runId: run.id }
  } catch (error) {
    log.warn('advisory fallback', { agentKey, error: String(error) })
    const fallback: AdvisoryResult = {
      summary:
        'AI недоступен (нет ANTHROPIC_API_KEY или запрос не удался) — показываю только детерминированные данные.',
      findings: [],
      proposedTasks: [],
    }
    await finishRun(run, { status: 'succeeded', output: JSON.stringify(fallback) })
    return { result: fallback, usedAi: false, runId: run.id }
  }
}

async function loadDomainSnapshot(userId: string, agentKey: AgentKey): Promise<string> {
  switch (agentKey) {
    case 'finance': {
      const [incomes, invoices, subscriptions] = await Promise.all([
        prisma.income.findMany({ where: { userId, deletedAt: null }, take: 30 }),
        prisma.invoice.findMany({ where: { userId, deletedAt: null, status: 'unpaid' }, take: 20 }),
        prisma.expense.findMany({ where: { userId, deletedAt: null, isSubscription: true }, take: 20 }),
      ])
      return [
        `Доходы: ${incomes.map((i) => `${i.title} ${i.amount}${i.currency} (${i.status})`).join('; ') || 'нет'}`,
        `Неоплаченные счета: ${invoices.map((i) => `${i.counterparty} ${i.amount}${i.currency}`).join('; ') || 'нет'}`,
        `Подписки: ${subscriptions.map((e) => `${e.title} ${e.amount}${e.currency}`).join('; ') || 'нет'}`,
      ].join('\n')
    }
    case 'content': {
      const [ideas, items] = await Promise.all([
        prisma.contentIdea.findMany({ where: { userId, deletedAt: null }, take: 20 }),
        prisma.contentItem.findMany({ where: { userId, deletedAt: null }, take: 20 }),
      ])
      return [
        `Идеи: ${ideas.map((i) => i.title).join('; ') || 'нет'}`,
        `Материалы: ${items.map((i) => `${i.title} (${i.status})`).join('; ') || 'нет'}`,
      ].join('\n')
    }
    case 'crm': {
      const followUps = await prisma.followUp.findMany({
        where: { userId, deletedAt: null, status: 'open' },
        include: { contact: { select: { name: true } } },
        take: 20,
      })
      return `Открытые follow-up: ${
        followUps.map((f) => `${f.contact.name} — ${f.subject}`).join('; ') || 'нет'
      }`
    }
    case 'energy': {
      const [sleep, energy, workouts] = await Promise.all([
        prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
        prisma.energyLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
        prisma.workout.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
      ])
      return [
        `Сон (последние дни): ${sleep.map((s) => `${s.hours}ч`).join(', ') || 'нет данных'}`,
        `Энергия: ${energy.map((e) => e.level).join(', ') || 'нет данных'}`,
        `Тренировки: ${workouts.map((w) => `${w.kind}/${w.intensity}`).join(', ') || 'нет данных'}`,
      ].join('\n')
    }
    case 'business': {
      const projects = await prisma.project.findMany({
        where: { userId, deletedAt: null, status: 'active' },
        include: { _count: { select: { tasks: true } } },
        take: 20,
      })
      return projects
        .map(
          (p) =>
            `${p.name} — прогресс ${Math.round(p.progress * 100)}%, задач ${p._count.tasks}, следующий шаг: ${
              p.nextAction ?? 'не задан'
            }`,
        )
        .join('\n')
    }
    case 'automation': {
      const [automations, automatable] = await Promise.all([
        prisma.automation.findMany({ where: { userId, deletedAt: null }, take: 20 }),
        prisma.task.findMany({ where: { userId, deletedAt: null, canAutomate: true }, take: 20 }),
      ])
      return [
        `Существующие автоматизации: ${automations.map((a) => `${a.name} (${a.status})`).join('; ') || 'нет'}`,
        `Задачи, помеченные как автоматизируемые: ${automatable.map((t) => t.title).join('; ') || 'нет'}`,
      ].join('\n')
    }
    default: {
      const [stalled, duplicates] = await Promise.all([
        findStalledTasks(userId),
        findDuplicateGroups(userId),
      ])
      return [
        `Зависшие задачи: ${stalled.map((s) => `${s.title} (${s.reason})`).join('; ') || 'нет'}`,
        `Возможные дубли: ${duplicates.map((g) => g.keepTitle).join('; ') || 'нет'}`,
      ].join('\n')
    }
  }
}

/** Entry point used by the UI command palette and the Telegram bot. */
export async function routeRequest(
  userId: string,
  timezone: string,
  input: string,
): Promise<OrchestratorResult> {
  const agentKey = selectAgent(input)
  const definition = AGENTS[agentKey]

  if (agentKey === 'inbox') {
    const result = await captureAndProcess({ userId, rawText: input, channel: 'web' })
    const lines = [
      result.summary,
      ...result.created.map((c) => `+ ${c.type}: ${c.title}${c.note ? ` — ${c.note}` : ''}`),
      ...result.skipped.map((s) => `· пропущено: ${s.title} (${s.reason})`),
      ...result.needsClarification.map((q) => `? ${q}`),
    ]
    return {
      agentKey,
      agentName: definition.name,
      text: lines.join('\n'),
      data: result,
      usedAi: result.usedAi,
    }
  }

  if (agentKey === 'chief_of_staff') {
    const dateKey = localDateKey(new Date(), timezone)
    const brief = await buildDailyBrief(userId, dateKey, timezone)
    const lines = [
      brief.brief.headline,
      `Главная задача: ${brief.brief.mainGoal}`,
      ...brief.brief.outcomes.map((o, index) => `${index + 1}. ${o}`),
      ...(brief.brief.risks.length > 0 ? ['', 'Риски:', ...brief.brief.risks.map((r) => `- ${r}`)] : []),
      '',
      brief.brief.closingNote,
    ]
    return {
      agentKey,
      agentName: definition.name,
      text: lines.join('\n'),
      data: brief,
      usedAi: brief.usedAi,
    }
  }

  const advisory = await runAdvisory(userId, agentKey, timezone, input)
  const lines = [
    advisory.result.summary,
    ...advisory.result.findings.map((f) => `[${f.severity}] ${f.title}: ${f.detail}`),
    ...advisory.result.proposedTasks.map((t) => `+ задача: ${t.title} — ${t.nextAction}`),
  ]
  return {
    agentKey,
    agentName: definition.name,
    text: lines.join('\n'),
    data: advisory.result,
    usedAi: advisory.usedAi,
  }
}

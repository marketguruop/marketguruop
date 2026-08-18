import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { guardRate } from '@/lib/api'
import {
  isAllowedChat,
  parseCommand,
  sendTelegramMessage,
  verifyWebhookSecret,
  TELEGRAM_HELP,
  type TelegramUpdate,
} from '@/lib/integrations/telegram'
import { routeRequest } from '@/lib/ai/orchestrator'
import { buildDailyBrief } from '@/lib/ai/agents/chief-of-staff'
import { buildWeekPlan } from '@/lib/services/plan'
import { captureAndProcess } from '@/lib/ai/agents/inbox-agent'
import { completeTask, createTask, findTaskByFuzzyTitle } from '@/lib/services/tasks'
import { approveRequest, listPendingApprovals, rejectRequest } from '@/lib/approvals/service'
import { formatRuDateKey, localDateKey, localTimeLabel, weekStartKey } from '@/lib/dates'

const log = logger('telegram/webhook')

/** Resolves which account a chat belongs to. Single-user deployment by design. */
async function resolveUser(chatId: number): Promise<{ id: string; timezone: string } | null> {
  const integration = await prisma.integration.findFirst({
    where: { provider: 'telegram', externalId: String(chatId) },
    select: { userId: true },
  })
  if (integration) {
    const user = await prisma.user.findUnique({
      where: { id: integration.userId },
      select: { id: true, timezone: true },
    })
    if (user) return user
  }

  if (!isAllowedChat(chatId)) return null
  const user = await prisma.user.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, timezone: true },
  })
  if (!user) return null

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: 'telegram' } },
    create: {
      userId: user.id,
      provider: 'telegram',
      displayName: 'Telegram Bot',
      externalId: String(chatId),
      status: 'connected',
    },
    update: { externalId: String(chatId), status: 'connected' },
  })
  return user
}

async function handleCommand(
  userId: string,
  timezone: string,
  command: string,
  args: string,
): Promise<string> {
  const now = new Date()
  switch (command) {
    case 'start':
    case 'help':
      return TELEGRAM_HELP

    case 'today': {
      const dateKey = localDateKey(now, timezone)
      const brief = await buildDailyBrief(userId, dateKey, timezone, now)
      const schedule = brief.plan.blocks
        .filter((b) => b.kind !== 'buffer')
        .map(
          (b) =>
            `${localTimeLabel(b.start, timezone)}–${localTimeLabel(b.end, timezone)} ${b.title}`,
        )
      return [
        `<b>${formatRuDateKey(dateKey)}</b>`,
        brief.brief.headline,
        '',
        `Главная задача: ${brief.brief.mainGoal}`,
        '',
        schedule.length > 0 ? schedule.join('\n') : 'Расписание пустое.',
        brief.brief.risks.length > 0 ? `\nРиски:\n${brief.brief.risks.map((r) => `• ${r}`).join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }

    case 'week': {
      const start = weekStartKey(now, timezone)
      const week = await buildWeekPlan(userId, start, timezone, now)
      const lines = week.days.map(
        (d) =>
          `${formatRuDateKey(d.dateKey)}: ${d.blocks.filter((b) => b.taskId).length} задач, загрузка ${Math.round(
            d.utilization * 100,
          )}%`,
      )
      return [
        '<b>План недели</b>',
        ...lines,
        '',
        `Средняя загрузка: ${Math.round(week.averageUtilization * 100)}%`,
        week.unscheduled.length > 0 ? `Не поместилось: ${week.unscheduled.length}` : 'Всё поместилось.',
      ].join('\n')
    }

    case 'add': {
      if (!args) return 'Напиши текст задачи: /add Позвонить в студию'
      const task = await createTask({ userId, title: args, source: 'telegram' })
      return task.created ? `Задача добавлена: ${args}` : `Такая задача уже есть — не дублирую.`
    }

    case 'idea': {
      if (!args) return 'Напиши идею: /idea Сделать рубрику про закулисье'
      const task = await createTask({
        userId,
        title: args,
        status: 'idea',
        priority: 'someday',
        source: 'telegram',
      })
      return task.created ? `Идея сохранена: ${args}` : 'Такая идея уже есть.'
    }

    case 'content': {
      if (!args) return 'Напиши идею для контента: /content Reels про утро'
      const idea = await prisma.contentIdea.create({
        data: { userId, title: args, source: 'telegram' },
      })
      return `Идея для контента сохранена (#${idea.id.slice(-6)}): ${args}`
    }

    case 'done': {
      if (!args) return 'Укажи часть названия: /done медиаплан'
      const task = await findTaskByFuzzyTitle(userId, args)
      if (!task) return 'Не нашла подходящую задачу.'
      await completeTask(userId, task.id)
      return `Готово: ${task.title}`
    }

    case 'energy': {
      const level = Number.parseInt(args, 10)
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return 'Укажи уровень от 1 до 5: /energy 4'
      }
      const date = new Date(now)
      date.setUTCHours(0, 0, 0, 0)
      await prisma.energyLog.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, level, source: 'telegram' },
        update: { level },
      })
      return `Записала уровень энергии: ${level}/5`
    }

    case 'inbox': {
      const items = await prisma.inboxItem.findMany({
        where: { userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      if (items.length === 0) return 'Входящие пусты.'
      return ['<b>Входящие</b>', ...items.map((i) => `• ${i.rawText.slice(0, 120)}`)].join('\n')
    }

    case 'review': {
      const dateKey = localDateKey(now, timezone)
      const brief = await buildDailyBrief(userId, dateKey, timezone, now)
      const date = new Date(now)
      date.setUTCHours(0, 0, 0, 0)
      await prisma.dailyReview.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          mainGoal: brief.brief.mainGoal,
          outcomes: JSON.stringify(brief.brief.outcomes),
          summary: brief.brief.headline,
          loadScore: brief.plan.utilization,
          status: 'closed',
          source: 'telegram',
        },
        update: {
          summary: brief.brief.headline,
          loadScore: brief.plan.utilization,
          status: 'closed',
        },
      })
      return ['День закрыт.', brief.brief.headline, '', brief.brief.closingNote].join('\n')
    }

    case 'approve':
    case 'cancel': {
      if (!args) {
        const pending = await listPendingApprovals(userId)
        if (pending.length === 0) return 'Нет запросов, ожидающих решения.'
        return [
          '<b>Ожидают подтверждения</b>',
          ...pending.map((p) => `• ${p.id.slice(-6)} — ${p.title}`),
          '',
          'Подтвердить: /approve <id>, отклонить: /cancel <id>',
        ].join('\n')
      }
      const pending = await listPendingApprovals(userId)
      const match = pending.find((p) => p.id.endsWith(args) || p.id === args)
      if (!match) return 'Не нашла такой запрос среди ожидающих.'
      const result =
        command === 'approve'
          ? await approveRequest(userId, match.id)
          : await rejectRequest(userId, match.id, 'Отклонено из Telegram')
      return result.message
    }

    default:
      return TELEGRAM_HELP
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = update.message
  const chatId = message?.chat.id
  if (!message || chatId === undefined) return NextResponse.json({ ok: true })

  // Telegram retries on non-2xx, so every path below returns 200.
  const limited = guardRate(`tg:${chatId}`, 30, 60_000)
  if (limited) {
    await sendTelegramMessage(String(chatId), 'Слишком много сообщений подряд. Подожди минуту.')
    return NextResponse.json({ ok: true })
  }

  try {
    const user = await resolveUser(chatId)
    if (!user) {
      await sendTelegramMessage(String(chatId), 'Этот чат не привязан к аккаунту LIFE OS.')
      return NextResponse.json({ ok: true })
    }

    const text = message.text?.trim() ?? ''
    if (!text) {
      await sendTelegramMessage(
        String(chatId),
        'Пока я принимаю только текст. Пришли расшифровку голосового — разберу её.',
      )
      return NextResponse.json({ ok: true })
    }

    const parsed = parseCommand(text)
    let reply: string
    if (parsed.command) {
      reply = await handleCommand(user.id, user.timezone, parsed.command, parsed.args)
    } else {
      // Plain messages go through the Inbox Agent, exactly like the web capture box.
      const captured = await captureAndProcess({
        userId: user.id,
        rawText: text,
        channel: 'telegram',
      })
      const routed =
        captured.created.length === 0 && captured.skipped.length === 0
          ? await routeRequest(user.id, user.timezone, text)
          : null
      reply = routed
        ? routed.text
        : [
            captured.summary,
            ...captured.created.map((c) => `+ ${c.type}: ${c.title}${c.note ? ` — ${c.note}` : ''}`),
            ...captured.needsClarification.map((q) => `? ${q}`),
          ].join('\n')
    }

    await sendTelegramMessage(String(chatId), reply.slice(0, 3900))
  } catch (error) {
    log.error('update failed', { error: String(error) })
    await sendTelegramMessage(String(chatId), 'Что-то пошло не так. Я записала ошибку в лог.')
  }

  return NextResponse.json({ ok: true })
}

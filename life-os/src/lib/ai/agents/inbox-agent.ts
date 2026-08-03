import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { callStructured } from '@/lib/ai/client'
import { INBOX_PARSE_JSON_SCHEMA, InboxParseSchema, type InboxParseResult, type InboxParsedItem } from '@/lib/ai/schemas'
import { AGENTS } from '@/lib/ai/registry'
import { buildContextBlock } from '@/lib/ai/memory'
import { heuristicParse } from '@/lib/ai/agents/heuristics'
import { chargeRun, finishRun, recordAction, startRun } from '@/lib/ai/run'
import { createTask } from '@/lib/services/tasks'
import { requestApproval } from '@/lib/approvals/service'
import { Priority, EnergyLevel, TaskContext } from '@/lib/domain/enums'

const log = logger('agent/inbox')

export interface CreatedEntity {
  type: string
  id: string
  title: string
  note?: string
}

export interface InboxProcessResult {
  summary: string
  created: CreatedEntity[]
  skipped: { title: string; reason: string }[]
  needsClarification: string[]
  usedAi: boolean
  runId: string
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function parseText(
  userId: string,
  timezone: string,
  rawText: string,
): Promise<{
  result: InboxParseResult
  usedAi: boolean
  costUsd: number
  inputTokens: number
  outputTokens: number
  aiError?: string
}> {
  const now = new Date()
  try {
    const context = await buildContextBlock(userId, timezone, rawText)
    const response = await callStructured({
      system: AGENTS.inbox.systemPrompt,
      jsonSchema: INBOX_PARSE_JSON_SCHEMA,
      parser: InboxParseSchema,
      maxTokens: 6000,
      prompt: [
        `Текущее время: ${now.toISOString()} (часовой пояс пользователя ${timezone}).`,
        '',
        'Контекст пользователя:',
        context,
        '',
        'Запись для разбора:',
        '"""',
        rawText,
        '"""',
      ].join('\n'),
    })
    return {
      result: response.data,
      usedAi: true,
      costUsd: response.costUsd,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    }
  } catch (error) {
    log.warn('falling back to heuristics', { error: String(error) })
    return {
      result: heuristicParse(rawText, now, timezone),
      usedAi: false,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      aiError: String(error),
    }
  }
}

async function resolveProjectId(userId: string, name: string | null | undefined): Promise<string | null> {
  if (!name) return null
  const project = await prisma.project.findFirst({
    where: { userId, deletedAt: null, name: { contains: name } },
    select: { id: true },
  })
  return project?.id ?? null
}

export async function processInboxItem(userId: string, itemId: string): Promise<InboxProcessResult> {
  const item = await prisma.inboxItem.findFirst({ where: { id: itemId, userId } })
  if (!item) throw new Error('Запись входящих не найдена.')

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const run = await startRun({
    userId,
    agentKey: 'inbox',
    trigger: item.channel,
    input: item.rawText,
  })

  await prisma.inboxItem.update({ where: { id: itemId }, data: { status: 'processing' } })

  const created: CreatedEntity[] = []
  const skipped: { title: string; reason: string }[] = []
  const needsClarification: string[] = []

  try {
    const parsed = await parseText(userId, user.timezone, item.rawText)
    chargeRun(run, parsed.costUsd)

    for (const entity of parsed.result.items) {
      const outcome = await materialize(userId, run.id, entity)
      if (outcome.kind === 'created') created.push(outcome.entity)
      else skipped.push(outcome.skip)
      if (entity.needsClarification && entity.clarificationQuestion) {
        needsClarification.push(`${entity.title}: ${entity.clarificationQuestion}`)
      }
    }

    await prisma.inboxItem.update({
      where: { id: itemId },
      data: {
        status: 'processed',
        summary: parsed.result.summary,
        result: JSON.stringify(parsed.result),
        createdEntities: JSON.stringify(created),
        confidence:
          parsed.result.items.reduce((sum, i) => sum + i.confidence, 0) /
          Math.max(1, parsed.result.items.length),
        needsClarification: needsClarification.length > 0,
        processedAt: new Date(),
        source: parsed.usedAi ? 'agent' : 'system',
      },
    })

    await finishRun(run, {
      status: 'succeeded',
      output: JSON.stringify({ summary: parsed.result.summary, created, skipped }),
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      error: parsed.aiError,
    })

    return {
      summary: parsed.result.summary,
      created,
      skipped,
      needsClarification,
      usedAi: parsed.usedAi,
      runId: run.id,
    }
  } catch (error) {
    await prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: 'failed', summary: String(error).slice(0, 500) },
    })
    await finishRun(run, { status: 'failed', error: String(error) })
    throw error
  }
}

type MaterializeOutcome =
  | { kind: 'created'; entity: CreatedEntity }
  | { kind: 'skipped'; skip: { title: string; reason: string } }

async function materialize(
  userId: string,
  runId: string,
  entity: InboxParsedItem,
): Promise<MaterializeOutcome> {
  const handle = { id: runId, userId, agentKey: 'inbox' as const, steps: 0, costUsd: 0 }
  const priority = Priority.safeParse(entity.priority).success ? entity.priority : 'medium'
  const energy = EnergyLevel.safeParse(entity.energy).success ? entity.energy : 'medium'
  const context = entity.context && TaskContext.safeParse(entity.context).success ? entity.context : null

  switch (entity.type) {
    case 'trash': {
      await recordAction(handle, { kind: 'classify_inbox_item', status: 'skipped', reason: 'Мусор или дубль' })
      return { kind: 'skipped', skip: { title: entity.title, reason: 'Классифицировано как мусор' } }
    }

    case 'note': {
      const note = await prisma.note.create({
        data: {
          userId,
          title: entity.title,
          body: entity.description ?? entity.title,
          source: 'agent',
          confidence: entity.confidence,
        },
      })
      await recordAction(handle, { kind: 'create_note', entityType: 'Note', entityId: note.id })
      return { kind: 'created', entity: { type: 'Заметка', id: note.id, title: note.title } }
    }

    case 'content': {
      const idea = await prisma.contentIdea.create({
        data: {
          userId,
          title: entity.title,
          hook: entity.nextAction ?? null,
          platforms: JSON.stringify(['instagram', 'reels']),
          priority,
          source: 'agent',
          confidence: entity.confidence,
        },
      })
      await recordAction(handle, { kind: 'create_idea', entityType: 'ContentIdea', entityId: idea.id })
      return { kind: 'created', entity: { type: 'Идея для контента', id: idea.id, title: idea.title } }
    }

    case 'project': {
      const project = await prisma.project.create({
        data: {
          userId,
          name: entity.title,
          description: entity.description ?? null,
          nextAction: entity.nextAction ?? null,
          deadline: safeDate(entity.deadline),
          priority,
          source: 'agent',
          confidence: entity.confidence,
        },
      })
      await recordAction(handle, { kind: 'create_task', entityType: 'Project', entityId: project.id })
      return { kind: 'created', entity: { type: 'Проект', id: project.id, title: project.name } }
    }

    case 'contact': {
      const contact = await prisma.contact.create({
        data: { userId, name: entity.title, notes: entity.description ?? null, source: 'agent' },
      })
      await recordAction(handle, { kind: 'create_task', entityType: 'Contact', entityId: contact.id })
      return { kind: 'created', entity: { type: 'Контакт', id: contact.id, title: contact.name } }
    }

    case 'event': {
      // Creating a calendar entry is a CONFIRM-level action — it goes to the
      // Approval Center with a preview instead of being written directly.
      const startsAt = safeDate(entity.startsAt)
      if (!startsAt) {
        const draft = await createTask({
          userId,
          title: entity.title,
          description: entity.description,
          nextAction: entity.nextAction ?? 'Уточнить дату и время',
          priority,
          energy,
          context,
          estimatedMinutes: entity.estimatedMinutes,
          status: 'clarification',
          needsClarification: true,
          source: 'agent',
          confidence: entity.confidence,
        })
        await recordAction(handle, { kind: 'create_task', entityType: 'Task', entityId: draft.id })
        return {
          kind: 'created',
          entity: {
            type: 'Черновик события',
            id: draft.id,
            title: entity.title,
            note: 'Нужна дата — создан черновик задачи',
          },
        }
      }
      const endsAt = new Date(startsAt.getTime() + entity.estimatedMinutes * 60_000)
      const approval = await requestApproval({
        userId,
        runId,
        agentKey: 'inbox',
        title: `Создать событие: ${entity.title}`,
        summary: `${startsAt.toISOString()} — ${endsAt.toISOString()}`,
        actionKind: 'create_calendar_event',
        payload: {
          title: entity.title,
          description: entity.description ?? null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        preview: [
          `Будет создано событие «${entity.title}».`,
          `Начало: ${startsAt.toISOString()}, конец: ${endsAt.toISOString()}.`,
          'Причина: событие распознано во входящей записи.',
        ].join('\n'),
        expiresInHours: 72,
      })
      await recordAction(handle, {
        kind: 'create_calendar_event',
        entityType: 'ApprovalRequest',
        entityId: approval.id,
        status: 'pending_approval',
        reason: 'Событие календаря требует подтверждения',
      })
      return {
        kind: 'created',
        entity: {
          type: 'Запрос на подтверждение',
          id: approval.id,
          title: entity.title,
          note: 'Событие ждёт подтверждения в Approval Center',
        },
      }
    }

    case 'idea': {
      const task = await createTask({
        userId,
        title: entity.title,
        description: entity.description,
        nextAction: entity.nextAction,
        priority: 'someday',
        energy,
        context,
        estimatedMinutes: entity.estimatedMinutes,
        status: 'idea',
        source: 'agent',
        confidence: entity.confidence,
      })
      await recordAction(handle, { kind: 'create_idea', entityType: 'Task', entityId: task.id })
      return task.created
        ? { kind: 'created', entity: { type: 'Идея', id: task.id, title: entity.title } }
        : { kind: 'skipped', skip: { title: entity.title, reason: 'Дубль существующей записи' } }
    }

    default: {
      const projectId = await resolveProjectId(userId, entity.project)
      const task = await createTask({
        userId,
        title: entity.title,
        description: entity.description,
        nextAction: entity.nextAction,
        projectId,
        priority,
        energy,
        context,
        estimatedMinutes: entity.estimatedMinutes,
        deadline: safeDate(entity.deadline),
        status: entity.needsClarification ? 'clarification' : 'inbox',
        canDelegate: entity.canDelegate,
        canAutomate: entity.canAutomate,
        needsClarification: entity.needsClarification,
        source: 'agent',
        confidence: entity.confidence,
      })
      await recordAction(handle, {
        kind: 'create_task',
        entityType: 'Task',
        entityId: task.id,
        status: task.created ? 'applied' : 'skipped',
        reason: task.created ? undefined : 'Найден дубль',
      })
      return task.created
        ? { kind: 'created', entity: { type: 'Задача', id: task.id, title: entity.title } }
        : { kind: 'skipped', skip: { title: entity.title, reason: 'Дубль существующей задачи' } }
    }
  }
}

export async function captureAndProcess(input: {
  userId: string
  rawText: string
  channel?: string
  kind?: string
}): Promise<InboxProcessResult> {
  const item = await prisma.inboxItem.create({
    data: {
      userId: input.userId,
      rawText: input.rawText,
      channel: input.channel ?? 'web',
      kind: input.kind ?? 'text',
    },
  })
  return processInboxItem(input.userId, item.id)
}

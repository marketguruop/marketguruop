import { prisma } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { classifyAction } from '@/lib/approvals/policy'
import { logger } from '@/lib/logger'
import { parseJsonObject } from '@/lib/domain/enums'
import { sendTelegramMessage } from '@/lib/integrations/telegram'
import { pushEventToGoogle } from '@/lib/integrations/google-calendar'

const log = logger('approvals')

export class ForbiddenActionError extends Error {
  constructor(kind: string) {
    super(`Действие «${kind}» запрещено без отдельного доступа.`)
    this.name = 'ForbiddenActionError'
  }
}

export interface ApprovalDraft {
  userId: string
  runId?: string | null
  agentKey: string
  title: string
  summary: string
  actionKind: string
  payload: Record<string, unknown>
  preview?: string
  conflicts?: string[]
  expiresInHours?: number
}

export async function requestApproval(draft: ApprovalDraft): Promise<{ id: string }> {
  const risk = classifyAction(draft.actionKind)
  if (risk === 'forbidden') throw new ForbiddenActionError(draft.actionKind)

  const created = await prisma.approvalRequest.create({
    data: {
      userId: draft.userId,
      runId: draft.runId ?? null,
      agentKey: draft.agentKey,
      title: draft.title,
      summary: draft.summary,
      actionKind: draft.actionKind,
      payload: JSON.stringify(draft.payload),
      riskLevel: risk,
      preview: draft.preview ?? null,
      conflicts: JSON.stringify(draft.conflicts ?? []),
      expiresAt: draft.expiresInHours
        ? new Date(Date.now() + draft.expiresInHours * 3_600_000)
        : null,
    },
  })

  await prisma.notification.create({
    data: {
      userId: draft.userId,
      title: `Нужно подтверждение: ${draft.title}`,
      body: draft.summary,
      kind: 'approval',
      link: `/approvals#${created.id}`,
    },
  })

  return { id: created.id }
}

export interface ApplyResult {
  ok: boolean
  message: string
  entityId?: string
}

/** Executes an approved action. Every branch is explicit — no dynamic dispatch. */
async function applyAction(
  userId: string,
  kind: string,
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  switch (kind) {
    case 'create_calendar_event': {
      const title = String(payload.title ?? 'Событие')
      const startsAt = new Date(String(payload.startsAt))
      const endsAt = new Date(String(payload.endsAt))
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return { ok: false, message: 'Некорректные даты события.' }
      }
      const event = await prisma.calendarEvent.create({
        data: {
          userId,
          title,
          description: payload.description ? String(payload.description) : null,
          location: payload.location ? String(payload.location) : null,
          startsAt,
          endsAt,
          travelMinutes: Number(payload.travelMinutes ?? 0),
          prepMinutes: Number(payload.prepMinutes ?? 0),
          recoveryMinutes: Number(payload.recoveryMinutes ?? 0),
          source: 'agent',
        },
      })
      const pushed = await pushEventToGoogle(userId, event.id)
      return {
        ok: true,
        entityId: event.id,
        message: pushed.synced
          ? 'Событие создано и отправлено в Google Calendar.'
          : `Событие создано локально. ${pushed.reason}`,
      }
    }

    case 'update_calendar_event':
    case 'move_calendar_event': {
      const eventId = String(payload.eventId ?? '')
      const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } })
      if (!existing) return { ok: false, message: 'Событие не найдено.' }
      const updated = await prisma.calendarEvent.update({
        where: { id: eventId },
        data: {
          startsAt: payload.startsAt ? new Date(String(payload.startsAt)) : existing.startsAt,
          endsAt: payload.endsAt ? new Date(String(payload.endsAt)) : existing.endsAt,
          title: payload.title ? String(payload.title) : existing.title,
        },
      })
      await recordAudit({
        userId,
        actor: 'agent:calendar',
        action: 'update',
        entityType: 'CalendarEvent',
        entityId: eventId,
        before: existing,
        after: updated,
      })
      return { ok: true, entityId: eventId, message: 'Событие обновлено.' }
    }

    case 'delete_calendar_event': {
      const eventId = String(payload.eventId ?? '')
      const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } })
      if (!existing) return { ok: false, message: 'Событие не найдено.' }
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { deletedAt: new Date(), status: 'cancelled' },
      })
      return { ok: true, entityId: eventId, message: 'Событие отменено (soft delete).' }
    }

    case 'delete_task': {
      const taskId = String(payload.taskId ?? '')
      const existing = await prisma.task.findFirst({ where: { id: taskId, userId } })
      if (!existing) return { ok: false, message: 'Задача не найдена.' }
      await prisma.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date(), status: 'cancelled' },
      })
      return { ok: true, entityId: taskId, message: 'Задача удалена (soft delete, можно вернуть).' }
    }

    case 'delegate_task': {
      const taskId = String(payload.taskId ?? '')
      const to = String(payload.to ?? '')
      const existing = await prisma.task.findFirst({ where: { id: taskId, userId } })
      if (!existing) return { ok: false, message: 'Задача не найдена.' }
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'delegated', delegatedTo: to, waitingOn: to },
      })
      return { ok: true, entityId: taskId, message: `Задача делегирована: ${to}.` }
    }

    case 'send_telegram_message': {
      const text = String(payload.text ?? '')
      const sent = await sendTelegramMessage(String(payload.chatId ?? ''), text)
      return { ok: sent.ok, message: sent.message }
    }

    case 'enable_automation':
    case 'create_automation': {
      const automationId = String(payload.automationId ?? '')
      const existing = await prisma.automation.findFirst({ where: { id: automationId, userId } })
      if (!existing) return { ok: false, message: 'Автоматизация не найдена.' }
      await prisma.automation.update({
        where: { id: automationId },
        data: { enabled: true, status: 'active' },
      })
      return { ok: true, entityId: automationId, message: 'Автоматизация включена.' }
    }

    case 'update_finance_record': {
      const invoiceId = String(payload.invoiceId ?? '')
      const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, userId } })
      if (!existing) return { ok: false, message: 'Счёт не найден.' }
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: String(payload.status ?? existing.status), paidAt: payload.paidAt ? new Date(String(payload.paidAt)) : existing.paidAt },
      })
      return { ok: true, entityId: invoiceId, message: 'Финансовая запись обновлена.' }
    }

    default:
      return { ok: false, message: `Обработчик для действия «${kind}» не реализован.` }
  }
}

export async function approveRequest(userId: string, approvalId: string): Promise<ApplyResult> {
  const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, userId } })
  if (!approval) return { ok: false, message: 'Запрос не найден.' }
  if (approval.status !== 'pending') {
    return { ok: false, message: `Запрос уже обработан: ${approval.status}.` }
  }
  if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: 'expired', decidedAt: new Date() },
    })
    return { ok: false, message: 'Срок подтверждения истёк.' }
  }

  const payload = parseJsonObject<Record<string, unknown>>(approval.payload, {})
  let result: ApplyResult
  try {
    result = await applyAction(userId, approval.actionKind, payload)
  } catch (error) {
    log.error('apply failed', { approvalId, error: String(error) })
    result = { ok: false, message: `Ошибка выполнения: ${String(error)}` }
  }

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: result.ok ? 'applied' : 'failed',
      decidedAt: new Date(),
      appliedAt: result.ok ? new Date() : null,
      error: result.ok ? null : result.message,
    },
  })

  await recordAudit({
    userId,
    actor: 'user',
    action: 'approve',
    entityType: 'ApprovalRequest',
    entityId: approvalId,
    after: { actionKind: approval.actionKind, result },
  })

  return result
}

export async function rejectRequest(
  userId: string,
  approvalId: string,
  reason?: string,
): Promise<ApplyResult> {
  const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, userId } })
  if (!approval) return { ok: false, message: 'Запрос не найден.' }
  if (approval.status !== 'pending') {
    return { ok: false, message: `Запрос уже обработан: ${approval.status}.` }
  }
  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { status: 'rejected', decidedAt: new Date(), error: reason ?? null },
  })
  await recordAudit({
    userId,
    actor: 'user',
    action: 'reject',
    entityType: 'ApprovalRequest',
    entityId: approvalId,
    after: { reason: reason ?? null },
  })
  return { ok: true, message: 'Запрос отклонён.' }
}

export async function listPendingApprovals(userId: string) {
  return prisma.approvalRequest.findMany({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

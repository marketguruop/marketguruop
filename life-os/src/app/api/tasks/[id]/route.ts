import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { recordAudit } from '@/lib/audit'
import { Priority, EnergyLevel, TaskStatus } from '@/lib/domain/enums'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: TaskStatus.optional(),
  priority: Priority.optional(),
  energy: EnergyLevel.optional(),
  nextAction: z.string().max(300).nullable().optional(),
  estimatedMinutes: z.number().int().min(5).max(480).optional(),
  deadline: z.string().datetime().nullable().optional(),
  delegatedTo: z.string().max(120).nullable().optional(),
  waitingOn: z.string().max(120).nullable().optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  return handle('tasks/update', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const { id } = await params

    const existing = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existing) return fail('Задача не найдена.', 404)

    const body = await parseBody(request, UpdateSchema)
    if (!body.ok) return body.response

    const { deadline, ...rest } = body.data
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(rest.status === 'completed' ? { completedAt: new Date() } : {}),
      },
    })

    await recordAudit({
      userId: user.id,
      actor: 'user',
      action: 'update',
      entityType: 'Task',
      entityId: id,
      before: { status: existing.status, priority: existing.priority },
      after: { status: updated.status, priority: updated.priority },
    })

    return ok(updated)
  })
}

export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  return handle('tasks/delete', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const { id } = await params
    const existing = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existing) return fail('Задача не найдена.', 404)

    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'cancelled' },
    })
    await recordAudit({
      userId: user.id,
      actor: 'user',
      action: 'delete',
      entityType: 'Task',
      entityId: id,
      before: { status: existing.status },
    })
    return ok({ deleted: true })
  })
}

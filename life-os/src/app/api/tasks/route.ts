import { z } from 'zod'
import { prisma } from '@/lib/db'
import { handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { createTask } from '@/lib/services/tasks'
import { Priority, EnergyLevel, TaskContext, TaskStatus, OPEN_TASK_STATUSES } from '@/lib/domain/enums'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  nextAction: z.string().max(300).optional(),
  projectId: z.string().optional(),
  priority: Priority.default('medium'),
  energy: EnergyLevel.default('medium'),
  context: TaskContext.optional(),
  estimatedMinutes: z.number().int().min(5).max(480).default(30),
  deadline: z.string().datetime().optional(),
  status: TaskStatus.default('inbox'),
})

export async function GET(request: Request): Promise<Response> {
  return handle('tasks/list', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const projectId = url.searchParams.get('projectId')
    const search = url.searchParams.get('q')

    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(status ? { status } : { status: { in: OPEN_TASK_STATUSES } }),
        ...(projectId ? { projectId } : {}),
        ...(search ? { title: { contains: search } } : {}),
      },
      include: { project: { select: { name: true } } },
      orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    })
    return ok(tasks)
  })
}

export async function POST(request: Request): Promise<Response> {
  return handle('tasks/create', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const body = await parseBody(request, CreateSchema)
    if (!body.ok) return body.response

    const result = await createTask({
      userId: user.id,
      ...body.data,
      deadline: body.data.deadline ? new Date(body.data.deadline) : null,
      source: 'manual',
    })
    return ok(result, result.created ? 201 : 200)
  })
}

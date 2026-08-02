import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guardRate, handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { captureAndProcess, processInboxItem } from '@/lib/ai/agents/inbox-agent'

const CaptureSchema = z.object({
  text: z.string().min(1).max(8000),
  channel: z.enum(['web', 'telegram', 'shortcut', 'api']).default('web'),
  kind: z.enum(['text', 'voice', 'link', 'photo', 'file']).default('text'),
  /** When false the item is stored but not parsed — used for bulk capture. */
  process: z.boolean().default(true),
})

export async function GET(): Promise<Response> {
  return handle('inbox/list', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const items = await prisma.inboxItem.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return ok(items)
  })
}

export async function POST(request: Request): Promise<Response> {
  return handle('inbox/capture', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user

    const limited = guardRate(`inbox:${user.id}`, 60, 60_000)
    if (limited) return limited

    const body = await parseBody(request, CaptureSchema)
    if (!body.ok) return body.response

    if (!body.data.process) {
      const item = await prisma.inboxItem.create({
        data: {
          userId: user.id,
          rawText: body.data.text,
          channel: body.data.channel,
          kind: body.data.kind,
        },
      })
      return ok({ itemId: item.id, processed: false })
    }

    const result = await captureAndProcess({
      userId: user.id,
      rawText: body.data.text,
      channel: body.data.channel,
      kind: body.data.kind,
    })
    return ok(result, 201)
  })
}

const ReprocessSchema = z.object({ itemId: z.string().min(1) })

export async function PUT(request: Request): Promise<Response> {
  return handle('inbox/reprocess', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const body = await parseBody(request, ReprocessSchema)
    if (!body.ok) return body.response
    const item = await prisma.inboxItem.findFirst({
      where: { id: body.data.itemId, userId: user.id },
    })
    if (!item) return fail('Запись не найдена.', 404)
    const result = await processInboxItem(user.id, item.id)
    return ok(result)
  })
}

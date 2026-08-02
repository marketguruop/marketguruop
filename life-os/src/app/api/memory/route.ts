import { z } from 'zod'
import { handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { clearMemory, listMemory, rememberFact } from '@/lib/ai/memory'

const RememberSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(2000),
  layer: z.enum(['short', 'working', 'long']).default('long'),
  category: z.enum(['goal', 'preference', 'rule', 'pattern', 'fact']).default('fact'),
  weight: z.number().min(0).max(3).default(1),
})

export async function GET(): Promise<Response> {
  return handle('memory/list', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    return ok(await listMemory(user.id))
  })
}

export async function POST(request: Request): Promise<Response> {
  return handle('memory/remember', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const body = await parseBody(request, RememberSchema)
    if (!body.ok) return body.response
    await rememberFact({ userId: user.id, ...body.data, source: 'manual' })
    return ok({ saved: true }, 201)
  })
}

export async function DELETE(request: Request): Promise<Response> {
  return handle('memory/clear', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const url = new URL(request.url)
    const layerParam = url.searchParams.get('layer')
    const layer =
      layerParam === 'short' || layerParam === 'working' || layerParam === 'long' ? layerParam : undefined
    const count = await clearMemory(user.id, layer)
    return ok({ cleared: count })
  })
}

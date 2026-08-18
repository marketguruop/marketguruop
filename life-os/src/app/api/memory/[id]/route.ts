import { handle, isResponse, ok, requireApiUser } from '@/lib/api'
import { forgetEntry } from '@/lib/ai/memory'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  return handle('memory/forget', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const { id } = await params
    await forgetEntry(user.id, id)
    return ok({ deleted: true })
  })
}

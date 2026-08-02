import { z } from 'zod'
import { handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { approveRequest, rejectRequest } from '@/lib/approvals/service'

const DecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  return handle('approvals/decide', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const { id } = await params
    const body = await parseBody(request, DecisionSchema)
    if (!body.ok) return body.response

    const result =
      body.data.decision === 'approve'
        ? await approveRequest(user.id, id)
        : await rejectRequest(user.id, id, body.data.reason)

    return ok(result, result.ok ? 200 : 409)
  })
}

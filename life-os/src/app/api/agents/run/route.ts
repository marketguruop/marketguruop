import { z } from 'zod'
import { handle, isResponse, ok, parseBody, requireApiUser, guardRate } from '@/lib/api'
import { routeRequest, runAdvisory } from '@/lib/ai/orchestrator'
import { AgentKey } from '@/lib/domain/enums'

const RunSchema = z.object({
  input: z.string().min(1).max(4000),
  /** Omit to let the Chief of Staff route the request. */
  agentKey: AgentKey.optional(),
})

export async function POST(request: Request): Promise<Response> {
  return handle('agents/run', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user

    const limited = guardRate(`agents:${user.id}`, 30, 60_000)
    if (limited) return limited

    const body = await parseBody(request, RunSchema)
    if (!body.ok) return body.response

    if (body.data.agentKey && body.data.agentKey !== 'inbox' && body.data.agentKey !== 'chief_of_staff') {
      const advisory = await runAdvisory(user.id, body.data.agentKey, user.timezone, body.data.input)
      return ok({
        agentKey: body.data.agentKey,
        usedAi: advisory.usedAi,
        data: advisory.result,
        text: advisory.result.summary,
      })
    }

    const result = await routeRequest(user.id, user.timezone, body.data.input)
    return ok(result)
  })
}

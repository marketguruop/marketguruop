import { z } from 'zod'
import { handle, isResponse, ok, parseBody, requireApiUser, guardRate } from '@/lib/api'
import { routeRequest } from '@/lib/ai/orchestrator'
import { isSpecialist, runSpecialist } from '@/lib/ai/agents/specialists'
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

    // An explicit agentKey bypasses routing — used by the per-section consoles.
    if (body.data.agentKey && isSpecialist(body.data.agentKey)) {
      const result = await runSpecialist(user.id, body.data.agentKey, user.timezone, body.data.input)
      return ok({
        agentKey: result.agentKey,
        agentName: result.agentName,
        usedAi: result.usedAi,
        data: result,
        text: [
          result.summary,
          ...result.findings.map((f) => `[${f.severity}] ${f.title}: ${f.detail}`),
          ...result.created.map((c) => `+ ${c.type}: ${c.title}${c.note ? ` — ${c.note}` : ''}`),
          ...result.skipped.map((s) => `· пропущено: ${s.title} (${s.reason})`),
        ].join('\n'),
      })
    }

    const result = await routeRequest(user.id, user.timezone, body.data.input)
    return ok(result)
  })
}

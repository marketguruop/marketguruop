import { z } from 'zod'
import { handle, isResponse, ok, parseBody, requireApiUser } from '@/lib/api'
import { buildDayPlan, buildWeekPlan, persistDayPlan } from '@/lib/services/plan'
import { reviewPlan } from '@/lib/ai/agents/review-agent'
import { localDateKey, weekStartKey } from '@/lib/dates'

export async function GET(request: Request): Promise<Response> {
  return handle('plan/get', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user

    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'day'
    const now = new Date()

    if (scope === 'week') {
      const start = url.searchParams.get('start') ?? weekStartKey(now, user.timezone)
      const plan = await buildWeekPlan(user.id, start, user.timezone, now)
      return ok(plan)
    }

    const dateKey = url.searchParams.get('date') ?? localDateKey(now, user.timezone)
    const plan = await buildDayPlan(user.id, dateKey, user.timezone, now)
    const findings = await reviewPlan(user.id, plan, now)
    return ok({ plan, findings })
  })
}

const ApplySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** Writes the plan as internal time blocks — a SAFE, fully reversible action. */
export async function POST(request: Request): Promise<Response> {
  return handle('plan/apply', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    const body = await parseBody(request, ApplySchema)
    if (!body.ok) return body.response

    const now = new Date()
    const plan = await buildDayPlan(user.id, body.data.date, user.timezone, now)
    const result = await persistDayPlan(user.id, plan, user.timezone)
    return ok({ ...result, plan })
  })
}

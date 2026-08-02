import { handle, isResponse, ok, requireApiUser, guardRate } from '@/lib/api'
import { syncCalendar } from '@/lib/integrations/google-calendar'

export async function POST(): Promise<Response> {
  return handle('calendar/sync', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user

    const limited = guardRate(`gcal:${user.id}`, 10, 60_000)
    if (limited) return limited

    const now = new Date()
    const from = new Date(now.getTime() - 7 * 86_400_000)
    const to = new Date(now.getTime() + 60 * 86_400_000)
    const result = await syncCalendar(user.id, from, to)
    return ok(result, result.synced ? 200 : 409)
  })
}

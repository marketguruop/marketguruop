import { prisma } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { hasAnthropic, hasGoogleCalendar, hasTelegram } from '@/lib/env'

export async function GET(): Promise<Response> {
  return handle('health', async () => {
    await prisma.$queryRaw`SELECT 1`
    return ok({
      status: 'up',
      integrations: {
        anthropic: hasAnthropic(),
        telegram: hasTelegram(),
        googleCalendar: hasGoogleCalendar(),
      },
    })
  })
}

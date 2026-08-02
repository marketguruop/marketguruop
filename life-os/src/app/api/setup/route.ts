import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { fail, guardRate, handle, ok, parseBody } from '@/lib/api'
import { bootstrap } from '@/lib/services/bootstrap'

/**
 * First-run setup for hosted deployments, where there is no shell to run the
 * seed script. Guarded by SETUP_TOKEN: without that variable the endpoint is
 * disabled entirely, so it cannot be left open by accident.
 */
const SetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов.'),
  name: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
})

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  return handle('setup', async () => {
    const expected = process.env.SETUP_TOKEN
    if (!expected) {
      return fail('Setup выключен: переменная SETUP_TOKEN не задана.', 404)
    }

    const limited = guardRate('setup', 5, 60_000)
    if (limited) return limited

    if (!tokenMatches(request.headers.get('x-setup-token'), expected)) {
      return fail('Неверный setup-токен.', 401)
    }

    const body = await parseBody(request, SetupSchema)
    if (!body.ok) return body.response

    const result = await bootstrap(body.data)
    return ok({
      ...result,
      message: result.createdUser
        ? 'Аккаунт создан. Удали SETUP_TOKEN из переменных окружения и передеплой.'
        : 'Аккаунт уже существовал — обновлены только агенты и правила.',
    })
  })
}

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'
import { fail, guardRate, handle, ok, parseBody } from '@/lib/api'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(request: Request): Promise<Response> {
  return handle('auth/login', async () => {
    const limited = guardRate('login', 20, 60_000)
    if (limited) return limited

    const body = await parseBody(request, LoginSchema)
    if (!body.ok) return body.response

    const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } })
    if (!user || user.deletedAt || !verifyPassword(body.data.password, user.passwordHash)) {
      return fail('Неверный email или пароль.', 401)
    }

    await createSession(user.id)
    return ok({ id: user.id, name: user.name, email: user.email })
  })
}

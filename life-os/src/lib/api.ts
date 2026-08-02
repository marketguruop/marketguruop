import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

const log = logger('api')

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status })
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser()
  if (!user) return fail('Требуется вход в систему.', 401)
  return user
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: fail('Тело запроса должно быть валидным JSON.') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: fail('Некорректные данные запроса.', 422, {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    }
  }
  return { ok: true, data: parsed.data }
}

export function guardRate(key: string, limit: number, windowMs: number): NextResponse | null {
  const result = rateLimit(key, limit, windowMs)
  if (result.allowed) return null
  return fail('Слишком много запросов. Попробуй чуть позже.', 429)
}

/** Wraps a handler so unexpected errors never leak stack traces to the client. */
export async function handle(
  scope: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    log.error(`${scope} failed`, { error: String(error) })
    return fail('Внутренняя ошибка. Подробности — в логах сервера.', 500)
  }
}

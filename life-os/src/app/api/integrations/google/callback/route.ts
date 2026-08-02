import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fail, handle, isResponse, requireApiUser } from '@/lib/api'
import { exchangeCode, GOOGLE_STATE_COOKIE, saveTokens } from '@/lib/integrations/google-calendar'
import { env } from '@/lib/env'

export async function GET(request: Request): Promise<Response> {
  return handle('google/callback', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user

    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const jar = await cookies()
    const expected = jar.get(GOOGLE_STATE_COOKIE)?.value

    if (!code) return fail('Google не вернул код авторизации.', 400)
    if (!state || !expected || state !== expected) {
      return fail('Не совпал state — запрос отклонён.', 400)
    }
    jar.delete(GOOGLE_STATE_COOKIE)

    const token = await exchangeCode(code)
    if (!token) return fail('Не удалось обменять код на токен.', 502)

    await saveTokens(user.id, token)
    return NextResponse.redirect(`${env().APP_URL}/settings?google=connected`)
  })
}

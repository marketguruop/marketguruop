import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fail, handle, isResponse, requireApiUser } from '@/lib/api'
import { buildAuthUrl, GOOGLE_STATE_COOKIE } from '@/lib/integrations/google-calendar'
import { hasGoogleCalendar } from '@/lib/env'

export async function GET(): Promise<Response> {
  return handle('google/start', async () => {
    const user = await requireApiUser()
    if (isResponse(user)) return user
    if (!hasGoogleCalendar()) {
      return fail('Google OAuth не настроен: заполни GOOGLE_CLIENT_ID, SECRET и REDIRECT_URI.', 409)
    }

    const state = randomBytes(16).toString('hex')
    const jar = await cookies()
    jar.set(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return NextResponse.redirect(buildAuthUrl(state))
  })
}

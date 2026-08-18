import { prisma } from '@/lib/db'
import { env, hasGoogleCalendar } from '@/lib/env'
import { logger } from '@/lib/logger'
import { parseJsonArray } from '@/lib/domain/enums'

const log = logger('google-calendar')

/** CSRF state cookie for the OAuth round trip. */
export const GOOGLE_STATE_COOKIE = 'lifeos_google_state'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

export function buildAuthUrl(state: string): string {
  const e = env()
  const params = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: e.GOOGLE_REDIRECT_URI ?? '',
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: SCOPES.join(' '),
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

export async function exchangeCode(code: string): Promise<TokenResponse | null> {
  const e = env()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: e.GOOGLE_CLIENT_ID ?? '',
      client_secret: e.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: e.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    log.warn('code exchange failed', { status: response.status })
    return null
  }
  return (await response.json()) as TokenResponse
}

async function refreshAccessToken(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'google_calendar' } },
  })
  if (!integration?.refreshToken) return null

  const e = env()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integration.refreshToken,
      client_id: e.GOOGLE_CLIENT_ID ?? '',
      client_secret: e.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: 'error', lastError: `refresh failed: ${response.status}` },
    })
    return null
  }
  const token = (await response.json()) as TokenResponse
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: token.access_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      status: 'connected',
      lastError: null,
    },
  })
  return token.access_token
}

async function getAccessToken(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'google_calendar' } },
  })
  if (!integration?.accessToken) return null
  const expiresSoon = !integration.expiresAt || integration.expiresAt.getTime() - Date.now() < 60_000
  if (expiresSoon) return refreshAccessToken(userId)
  return integration.accessToken
}

export async function saveTokens(userId: string, token: TokenResponse): Promise<void> {
  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'google_calendar' } },
    create: {
      userId,
      provider: 'google_calendar',
      displayName: 'Google Calendar',
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: JSON.stringify(token.scope?.split(' ') ?? SCOPES),
      status: 'connected',
    },
    update: {
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      status: 'connected',
      lastError: null,
    },
  })
}

interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  status?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: { email?: string; displayName?: string }[]
}

export interface SyncResult {
  synced: boolean
  imported: number
  updated: number
  reason: string
}

/**
 * Pulls events from every calendar the user has access to and upserts them by
 * `externalId`, so repeated syncs never produce duplicates.
 */
export async function syncCalendar(
  userId: string,
  from: Date,
  to: Date,
): Promise<SyncResult> {
  if (!hasGoogleCalendar()) {
    return { synced: false, imported: 0, updated: 0, reason: 'Google Calendar не настроен в .env.' }
  }
  const token = await getAccessToken(userId)
  if (!token) {
    return { synced: false, imported: 0, updated: 0, reason: 'Нет действующего доступа к Google.' }
  }

  const calendarIds = await listCalendarIds(token)
  let imported = 0
  let updated = 0

  for (const calendarId of calendarIds) {
    const url = new URL(`${API}/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set('timeMin', from.toISOString())
    url.searchParams.set('timeMax', to.toISOString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')

    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) {
      log.warn('events fetch failed', { calendarId, status: response.status })
      continue
    }
    const body = (await response.json()) as { items?: GoogleEvent[] }

    for (const item of body.items ?? []) {
      if (item.status === 'cancelled') continue
      const startsAt = item.start?.dateTime ?? item.start?.date
      const endsAt = item.end?.dateTime ?? item.end?.date
      if (!startsAt || !endsAt) continue

      const attendees = (item.attendees ?? []).map((a) => a.displayName ?? a.email ?? 'участник')
      const data = {
        title: item.summary ?? 'Без названия',
        description: item.description ?? null,
        location: item.location ?? null,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        allDay: Boolean(item.start?.date),
        calendarId,
        attendees: JSON.stringify(attendees),
        hasOtherPeople: attendees.length > 0,
        timezone: item.start?.timeZone ?? env().DEFAULT_TIMEZONE,
        source: 'google',
      }

      const existing = await prisma.calendarEvent.findUnique({
        where: { userId_externalId: { userId, externalId: item.id } },
      })
      if (existing) {
        await prisma.calendarEvent.update({ where: { id: existing.id }, data })
        updated += 1
      } else {
        await prisma.calendarEvent.create({ data: { ...data, userId, externalId: item.id } })
        imported += 1
      }
    }
  }

  await prisma.integration.updateMany({
    where: { userId, provider: 'google_calendar' },
    data: { lastSyncAt: new Date(), lastError: null },
  })

  return { synced: true, imported, updated, reason: 'Синхронизация выполнена.' }
}

async function listCalendarIds(token: string): Promise<string[]> {
  const response = await fetch(`${API}/users/me/calendarList`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) return ['primary']
  const body = (await response.json()) as { items?: { id: string; selected?: boolean }[] }
  const ids = (body.items ?? []).filter((c) => c.selected !== false).map((c) => c.id)
  return ids.length > 0 ? ids : ['primary']
}

/**
 * Pushes a locally created event to Google. Idempotent: an event that already
 * carries an `externalId` is never pushed twice.
 */
export async function pushEventToGoogle(
  userId: string,
  eventId: string,
): Promise<{ synced: boolean; reason: string }> {
  if (!hasGoogleCalendar()) {
    return { synced: false, reason: 'Google Calendar не настроен — событие осталось локальным.' }
  }
  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } })
  if (!event) return { synced: false, reason: 'Событие не найдено.' }
  if (event.externalId) return { synced: true, reason: 'Событие уже синхронизировано.' }

  const token = await getAccessToken(userId)
  if (!token) return { synced: false, reason: 'Нет действующего доступа к Google.' }

  const response = await fetch(`${API}/calendars/primary/events`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: { dateTime: event.startsAt.toISOString(), timeZone: event.timezone },
      end: { dateTime: event.endsAt.toISOString(), timeZone: event.timezone },
    }),
  })
  if (!response.ok) {
    const reason = `Google вернул ${response.status}.`
    await prisma.integration.updateMany({
      where: { userId, provider: 'google_calendar' },
      data: { lastError: reason },
    })
    return { synced: false, reason }
  }
  const created = (await response.json()) as { id: string }
  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { externalId: created.id, calendarId: 'primary' },
  })
  return { synced: true, reason: 'Событие создано в Google Calendar.' }
}

export function attendeesOf(raw: string): string[] {
  return parseJsonArray<string>(raw)
}

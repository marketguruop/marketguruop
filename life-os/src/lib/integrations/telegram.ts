import { env, hasTelegram } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('telegram')
const API = 'https://api.telegram.org'

export interface TelegramSendResult {
  ok: boolean
  message: string
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  if (!hasTelegram()) {
    return { ok: false, message: 'TELEGRAM_BOT_TOKEN не настроен — сообщение не отправлено.' }
  }
  if (!chatId) return { ok: false, message: 'Не указан chatId.' }

  try {
    const response = await fetch(`${API}/bot${env().TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!response.ok) {
      const body = await response.text()
      log.warn('sendMessage failed', { status: response.status, body })
      return { ok: false, message: `Telegram вернул ${response.status}.` }
    }
    return { ok: true, message: 'Сообщение отправлено.' }
  } catch (error) {
    log.error('sendMessage error', { error: String(error) })
    return { ok: false, message: 'Не удалось связаться с Telegram.' }
  }
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number }
    text?: string
    voice?: { file_id: string }
    from?: { id: number; first_name?: string }
  }
}

export interface ParsedCommand {
  command: string | null
  args: string
}

const KNOWN_COMMANDS = [
  'today',
  'week',
  'add',
  'idea',
  'content',
  'done',
  'energy',
  'inbox',
  'review',
  'approve',
  'cancel',
  'start',
  'help',
] as const

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return { command: null, args: trimmed }
  const [head, ...rest] = trimmed.slice(1).split(/\s+/)
  const command = (head ?? '').split('@')[0]?.toLowerCase() ?? ''
  const known = (KNOWN_COMMANDS as readonly string[]).includes(command)
  return { command: known ? command : null, args: rest.join(' ') }
}

/** Verifies the secret token Telegram sends with each webhook call. */
export function verifyWebhookSecret(header: string | null): boolean {
  const expected = env().TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true // no secret configured — accept (dev only)
  return header === expected
}

export function isAllowedChat(chatId: number | string): boolean {
  const allowed = env().TELEGRAM_ALLOWED_CHAT_ID
  if (!allowed) return true
  return String(chatId) === allowed
}

export const TELEGRAM_HELP = `Команды:
/today — план дня
/week — план недели
/add <текст> — добавить задачу
/idea <текст> — добавить идею
/content <текст> — идея для контента
/done <часть названия> — завершить задачу
/energy <1-5> — сохранить уровень энергии
/inbox — показать входящие
/review — закрыть день
/approve <id> — подтвердить действие
/cancel <id> — отменить действие

Можно просто написать сообщение — Inbox Agent разберёт его сам.`

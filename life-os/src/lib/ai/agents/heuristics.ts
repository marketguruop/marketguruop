import type { InboxParseResult, InboxParsedItem } from '@/lib/ai/schemas'
import { localDateKey, zonedParts, zonedToUtc, DEFAULT_TZ } from '@/lib/dates'

/**
 * Deterministic fallback for the Inbox Agent.
 *
 * It runs whenever ANTHROPIC_API_KEY is absent and as the safety net when a model
 * call fails, so capture never silently drops a thought. It is intentionally
 * conservative: low confidence, needsClarification where it is guessing.
 */

/**
 * `\b` in JavaScript is ASCII-only, so it never fires between Cyrillic letters.
 * These Unicode lookarounds are the working equivalent.
 */
const NOT_BEFORE = '(?<![\\p{L}\\p{N}])'
const NOT_AFTER = '(?![\\p{L}\\p{N}])'

/** Matches a Russian infinitive — the marker of a new action in a run-on sentence. */
const INFINITIVE = new RegExp(`[\\p{L}]+(?:ть|ться)${NOT_AFTER}`, 'iu')

function word(pattern: string): RegExp {
  return new RegExp(`${NOT_BEFORE}(?:${pattern})`, 'iu')
}

const LEAD_NOISE =
  /^(?:мне\s+)?(?:нужно|надо|не\s+забыть|срочно|важно|обязательно|хочу|давай|надо\s+бы)\s+/iu

const WEEKDAYS: Record<string, number> = {
  понедельник: 1, вторник: 2, среда: 3, среду: 3, четверг: 4,
  пятница: 5, пятницу: 5, суббота: 6, субботу: 6, воскресенье: 0,
}

interface Rule {
  type: InboxParsedItem['type']
  test: RegExp
  energy?: InboxParsedItem['energy']
  context?: InboxParsedItem['context']
  minutes?: number
}

/**
 * Order matters: the first match wins. Communication verbs come first because
 * "написать Саше про съёмку" is a message, not a piece of content; content
 * comes before "идея" because "придумать три Reels" is production work.
 */
const RULES: Rule[] = [
  { type: 'contact', test: word('написать|позвонить|ответить|связаться|договорит|согласовать|уточнить\\s+у'), energy: 'low', context: 'calls', minutes: 15 },
  { type: 'purchase', test: word('купить|заказать|приобрести|оформить\\s+заказ'), energy: 'low', context: 'errand', minutes: 20 },
  { type: 'finance', test: word('оплатить|сч[её]т|инвойс|гонорар|зарплат|бюджет|налог'), energy: 'low', context: 'admin', minutes: 20 },
  { type: 'health', test: word('врач|анализ|витамин|массаж|стоматолог|тренировк|зал'), energy: 'low', context: 'errand', minutes: 60 },
  { type: 'event', test: word('встреч|созвон|интервью|ужин|обед|перел[её]т|рейс'), energy: 'medium', context: 'calls', minutes: 60 },
  { type: 'content', test: word('reels?|рилс|сторис|stories|tiktok|тикток|контент|снять|съ[её]мк|ролик|видео|пост'), energy: 'high', context: 'creative', minutes: 60 },
  { type: 'idea', test: word('иде[яю]|придумать'), energy: 'high', context: 'creative', minutes: 30 },
  { type: 'note', test: word('запомнить|заметка|на\\s+будущее'), energy: 'low', context: 'admin', minutes: 5 },
]

export function splitClauses(text: string): string[] {
  return text
    .split(/[\n;]+/u)
    .flatMap((chunk) => chunk.split(new RegExp(`\\s+и\\s+(?=${INFINITIVE.source})`, 'iu')))
    .flatMap((chunk) => chunk.split(new RegExp(`,\\s*(?=${INFINITIVE.source})`, 'iu')))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function extractDeadline(
  clause: string,
  now: Date,
  timezone: string = DEFAULT_TZ,
): { iso: string | null; matched: string | null } {
  const lower = clause.toLowerCase()
  const p = zonedParts(now, timezone)
  const at = (dayOffset: number, hour = 18): string =>
    zonedToUtc(p.year, p.month, p.day + dayOffset, hour, 0, timezone).toISOString()

  const timeMatch = lower.match(/(?<![\p{L}\p{N}])в\s+(\d{1,2})(?::(\d{2}))?(?![\p{N}])/u)
  const hour = timeMatch ? Number(timeMatch[1]) : 18
  const validHour = hour >= 0 && hour <= 23 ? hour : 18

  if (word('послезавтра').test(lower)) return { iso: at(2, validHour), matched: 'послезавтра' }
  if (word('сегодня').test(lower)) return { iso: at(0, validHour), matched: 'сегодня' }
  if (word('завтра').test(lower)) return { iso: at(1, validHour), matched: 'завтра' }
  if (/на\s+следующей\s+неделе/u.test(lower)) return { iso: at(7, validHour), matched: 'следующая неделя' }

  for (const [dayName, dow] of Object.entries(WEEKDAYS)) {
    if (word(`в?\\s*${dayName}`).test(lower)) {
      const todayDow = new Date(zonedToUtc(p.year, p.month, p.day, 12, 0, timezone)).getUTCDay()
      const delta = (dow - todayDow + 7) % 7 || 7
      return { iso: at(delta, validHour), matched: dayName }
    }
  }
  return { iso: null, matched: null }
}

const LEAD_DATE = /^(?:сегодня|завтра|послезавтра|на\s+следующей\s+неделе)\s+/iu

function cleanTitle(clause: string): string {
  // Prefixes stack ("завтра нужно написать…"), so strip until nothing changes.
  let base = clause.trim()
  for (let pass = 0; pass < 4; pass += 1) {
    const next = base.replace(LEAD_DATE, '').replace(LEAD_NOISE, '').trim()
    if (next === base || next.length === 0) break
    base = next
  }
  const capped = base.length > 120 ? `${base.slice(0, 119)}…` : base
  return capped.charAt(0).toUpperCase() + capped.slice(1)
}

function detectPriority(clause: string, hasDeadline: boolean): InboxParsedItem['priority'] {
  const lower = clause.toLowerCase()
  if (word('срочно|критично|горит|дедлайн\\s+сегодня').test(lower)) return 'critical'
  if (word('важно|обязательно').test(lower)) return 'high'
  if (word('когда-нибудь|потом').test(lower)) return 'someday'
  return hasDeadline ? 'high' : 'medium'
}

export function heuristicParse(
  text: string,
  now: Date = new Date(),
  timezone: string = DEFAULT_TZ,
): InboxParseResult {
  const clauses = splitClauses(text)
  const items: InboxParsedItem[] = []

  for (const clause of clauses) {
    if (clause.replace(/[^\p{L}\p{N}]/gu, '').length < 3) {
      items.push({
        type: 'trash',
        title: clause.slice(0, 60) || 'Пустая запись',
        priority: 'someday',
        estimatedMinutes: 5,
        energy: 'low',
        canDelegate: false,
        canAutomate: false,
        confidence: 0.9,
        needsClarification: false,
      })
      continue
    }

    const rule = RULES.find((r) => r.test.test(clause))
    const { iso } = extractDeadline(clause, now, timezone)
    const type: InboxParsedItem['type'] = rule?.type === 'contact' ? 'task' : (rule?.type ?? 'task')
    const isEvent = type === 'event'

    items.push({
      type,
      title: cleanTitle(clause),
      description: clause.trim() === cleanTitle(clause) ? null : clause.trim(),
      project: null,
      priority: detectPriority(clause, Boolean(iso)),
      estimatedMinutes: rule?.minutes ?? 30,
      energy: rule?.energy ?? 'medium',
      context: rule?.context ?? null,
      deadline: isEvent ? null : iso,
      startsAt: isEvent ? iso : null,
      nextAction: cleanTitle(clause),
      canDelegate: type === 'purchase' || rule?.context === 'admin',
      canAutomate: type === 'finance',
      // Local parsing is a fallback, not a judgement — flag it as uncertain.
      confidence: 0.45,
      needsClarification: isEvent && !iso,
      clarificationQuestion: isEvent && !iso ? 'На какое время назначено событие?' : null,
    })
  }

  if (items.length === 0) {
    items.push({
      type: 'note',
      title: text.slice(0, 80) || 'Пустая запись',
      priority: 'someday',
      estimatedMinutes: 5,
      energy: 'low',
      canDelegate: false,
      canAutomate: false,
      confidence: 0.3,
      needsClarification: true,
      clarificationQuestion: 'Что с этим нужно сделать?',
    })
  }

  const realItems = items.filter((i) => i.type !== 'trash')
  const summary =
    realItems.length > 0
      ? `Разобрано без AI: ${realItems.length} шт. — ${realItems
          .slice(0, 3)
          .map((i) => i.title)
          .join('; ')}`
      : 'Запись не содержит действий.'

  return { summary, items }
}

export function todayKeyFor(now: Date, timezone: string): string {
  return localDateKey(now, timezone)
}

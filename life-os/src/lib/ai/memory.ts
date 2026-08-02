import { prisma } from '@/lib/db'
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums'
import { localDateKey, weekDayKeys, weekStartKey } from '@/lib/dates'

/**
 * Three memory layers:
 *  - short   — the current conversation / inbox item, held by the caller;
 *  - working — the live week: active projects, deadlines, pending answers (derived, never stale);
 *  - long    — goals, preferences, rules, patterns (stored rows the user can edit or delete).
 *
 * Nothing here dumps the whole history into a prompt: `retrieve` scores entries
 * against the request and returns only what is relevant.
 */

export interface MemoryHit {
  id: string
  key: string
  value: string
  category: string
  weight: number
  score: number
}

const STOPWORDS = new Set([
  'и', 'в', 'на', 'с', 'по', 'для', 'что', 'как', 'это', 'мне', 'не', 'the', 'a', 'to', 'of',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

export async function rememberFact(input: {
  userId: string
  key: string
  value: string
  layer?: 'short' | 'working' | 'long'
  category?: 'goal' | 'preference' | 'rule' | 'pattern' | 'fact'
  weight?: number
  tags?: string[]
  expiresAt?: Date | null
  source?: string
}): Promise<void> {
  const layer = input.layer ?? 'long'
  await prisma.memoryEntry.upsert({
    where: { userId_layer_key: { userId: input.userId, layer, key: input.key } },
    create: {
      userId: input.userId,
      layer,
      key: input.key,
      value: input.value,
      category: input.category ?? 'fact',
      weight: input.weight ?? 1,
      tags: JSON.stringify(input.tags ?? []),
      expiresAt: input.expiresAt ?? null,
      source: input.source ?? 'manual',
    },
    update: {
      value: input.value,
      category: input.category ?? 'fact',
      weight: input.weight ?? 1,
      tags: JSON.stringify(input.tags ?? []),
      expiresAt: input.expiresAt ?? null,
      deletedAt: null,
      status: 'active',
    },
  })
}

export async function forgetEntry(userId: string, id: string): Promise<void> {
  await prisma.memoryEntry.updateMany({
    where: { id, userId },
    data: { deletedAt: new Date(), status: 'deleted' },
  })
}

export async function clearMemory(userId: string, layer?: 'short' | 'working' | 'long'): Promise<number> {
  const result = await prisma.memoryEntry.updateMany({
    where: { userId, deletedAt: null, ...(layer ? { layer } : {}) },
    data: { deletedAt: new Date(), status: 'deleted' },
  })
  return result.count
}

export async function listMemory(userId: string) {
  return prisma.memoryEntry.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ layer: 'asc' }, { weight: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  })
}

/** Relevance retrieval: keyword overlap × weight, with a floor for rules and goals. */
export async function retrieveMemory(
  userId: string,
  query: string,
  limit = 12,
): Promise<MemoryHit[]> {
  const now = new Date()
  const entries = await prisma.memoryEntry.findMany({
    where: { userId, deletedAt: null, status: 'active' },
    take: 500,
  })
  const queryTokens = new Set(tokenize(query))

  return entries
    .filter((e) => !e.expiresAt || e.expiresAt.getTime() > now.getTime())
    .map((e) => {
      const entryTokens = tokenize(`${e.key} ${e.value}`)
      const overlap = entryTokens.filter((t) => queryTokens.has(t)).length
      const base = entryTokens.length > 0 ? overlap / Math.sqrt(entryTokens.length) : 0
      // Rules and goals stay in context even when they share no keywords.
      const floor = e.category === 'rule' || e.category === 'goal' ? 0.35 : 0
      return {
        id: e.id,
        key: e.key,
        value: e.value,
        category: e.category,
        weight: e.weight,
        score: Math.max(base, floor) * e.weight,
      }
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface WorkingMemory {
  todayKey: string
  weekKeys: string[]
  activeProjects: { id: string; name: string; deadline: string | null; nextAction: string | null }[]
  upcomingDeadlines: { id: string; title: string; deadline: string }[]
  waitingOn: { id: string; title: string; who: string }[]
  openTaskCount: number
}

export async function buildWorkingMemory(userId: string, timezone: string): Promise<WorkingMemory> {
  const now = new Date()
  const todayKey = localDateKey(now, timezone)
  const weekKeys = weekDayKeys(weekStartKey(now, timezone))
  const horizon = new Date(now.getTime() + 14 * 86_400_000)

  const [projects, deadlines, waiting, openTaskCount] = await Promise.all([
    prisma.project.findMany({
      where: { userId, deletedAt: null, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { id: true, name: true, deadline: true, nextAction: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES },
        deadline: { not: null, lte: horizon },
      },
      orderBy: { deadline: 'asc' },
      take: 15,
      select: { id: true, title: true, deadline: true },
    }),
    prisma.task.findMany({
      where: { userId, deletedAt: null, status: { in: ['waiting', 'delegated'] } },
      take: 15,
      select: { id: true, title: true, waitingOn: true, delegatedTo: true },
    }),
    prisma.task.count({
      where: { userId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } },
    }),
  ])

  return {
    todayKey,
    weekKeys,
    activeProjects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      deadline: p.deadline ? localDateKey(p.deadline, timezone) : null,
      nextAction: p.nextAction,
    })),
    upcomingDeadlines: deadlines
      .filter((t): t is typeof t & { deadline: Date } => t.deadline !== null)
      .map((t) => ({ id: t.id, title: t.title, deadline: localDateKey(t.deadline, timezone) })),
    waitingOn: waiting.map((t) => ({
      id: t.id,
      title: t.title,
      who: t.waitingOn ?? t.delegatedTo ?? 'неизвестно',
    })),
    openTaskCount,
  }
}

/** Compact, prompt-ready context: only the relevant long-term facts plus the live week. */
export async function buildContextBlock(
  userId: string,
  timezone: string,
  query: string,
): Promise<string> {
  const [hits, working] = await Promise.all([
    retrieveMemory(userId, query),
    buildWorkingMemory(userId, timezone),
  ])

  const longTerm = hits.length
    ? hits.map((h) => `- [${h.category}] ${h.key}: ${h.value}`).join('\n')
    : '- (пусто)'

  const projects = working.activeProjects.length
    ? working.activeProjects
        .map((p) => `- ${p.name}${p.deadline ? ` (дедлайн ${p.deadline})` : ''}`)
        .join('\n')
    : '- (нет активных проектов)'

  const deadlines = working.upcomingDeadlines.length
    ? working.upcomingDeadlines.map((d) => `- ${d.deadline}: ${d.title}`).join('\n')
    : '- (нет ближайших дедлайнов)'

  const waiting = working.waitingOn.length
    ? working.waitingOn.map((w) => `- ${w.title} — ждём: ${w.who}`).join('\n')
    : '- (никого не ждём)'

  return [
    `Сегодня: ${working.todayKey}. Часовой пояс: ${timezone}.`,
    `Открытых задач: ${working.openTaskCount}.`,
    '',
    'Долгосрочная память (цели, правила, предпочтения):',
    longTerm,
    '',
    'Активные проекты:',
    projects,
    '',
    'Ближайшие дедлайны:',
    deadlines,
    '',
    'Ждём ответа:',
    waiting,
  ].join('\n')
}

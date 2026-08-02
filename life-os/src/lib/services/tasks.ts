import { prisma } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { OPEN_TASK_STATUSES, type Priority, type EnergyLevel, type TaskContext } from '@/lib/domain/enums'

const STOPWORDS = new Set(['нужно', 'надо', 'the', 'a', 'для', 'про', 'на', 'в', 'и', 'с'])

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .sort()
    .join(' ')
}

/** Jaccard similarity over normalised word sets. */
export function titleSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeTitle(a).split(' ').filter(Boolean))
  const setB = new Set(normalizeTitle(b).split(' ').filter(Boolean))
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) if (setB.has(token)) intersection += 1
  return intersection / (setA.size + setB.size - intersection)
}

export const DUPLICATE_THRESHOLD = 0.8

export interface CreateTaskInput {
  userId: string
  title: string
  description?: string | null
  nextAction?: string | null
  projectId?: string | null
  priority?: Priority
  energy?: EnergyLevel
  context?: TaskContext | null
  estimatedMinutes?: number
  deadline?: Date | null
  status?: string
  canDelegate?: boolean
  canAutomate?: boolean
  needsClarification?: boolean
  source?: string
  confidence?: number
}

export interface CreateTaskResult {
  id: string
  created: boolean
  duplicateOfId?: string
}

/** Creates a task unless an open task with a near-identical title already exists. */
export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const candidates = await prisma.task.findMany({
    where: {
      userId: input.userId,
      deletedAt: null,
      status: { in: OPEN_TASK_STATUSES },
    },
    select: { id: true, title: true },
    take: 300,
  })

  const duplicate = candidates.find((c) => titleSimilarity(c.title, input.title) >= DUPLICATE_THRESHOLD)
  if (duplicate) {
    return { id: duplicate.id, created: false, duplicateOfId: duplicate.id }
  }

  const task = await prisma.task.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      nextAction: input.nextAction ?? null,
      projectId: input.projectId ?? null,
      priority: input.priority ?? 'medium',
      energy: input.energy ?? 'medium',
      context: input.context ?? null,
      estimatedMinutes: input.estimatedMinutes ?? 30,
      deadline: input.deadline ?? null,
      status: input.status ?? 'inbox',
      canDelegate: input.canDelegate ?? false,
      canAutomate: input.canAutomate ?? false,
      needsClarification: input.needsClarification ?? false,
      source: input.source ?? 'manual',
      confidence: input.confidence ?? 1,
    },
  })

  await recordAudit({
    userId: input.userId,
    actor: input.source === 'agent' ? 'agent:inbox' : 'user',
    action: 'create',
    entityType: 'Task',
    entityId: task.id,
    after: { title: task.title, status: task.status },
  })

  return { id: task.id, created: true }
}

export async function completeTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId, deletedAt: null } })
  if (!task) return false
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'completed', completedAt: new Date() },
  })
  await recordAudit({
    userId,
    actor: 'user',
    action: 'update',
    entityType: 'Task',
    entityId: taskId,
    before: { status: task.status },
    after: { status: 'completed' },
  })
  return true
}

export async function findTaskByFuzzyTitle(userId: string, query: string) {
  const tasks = await prisma.task.findMany({
    where: { userId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } },
    take: 300,
  })
  const lower = query.toLowerCase().trim()
  const direct = tasks.find((t) => t.title.toLowerCase().includes(lower))
  if (direct) return direct
  const ranked = tasks
    .map((t) => ({ task: t, score: titleSimilarity(t.title, query) }))
    .sort((a, b) => b.score - a.score)[0]
  return ranked && ranked.score >= 0.5 ? ranked.task : null
}

export interface StalledTask {
  id: string
  title: string
  reason: string
  days: number
}

/** Tasks that have not moved and are not blocked by a known dependency. */
export async function findStalledTasks(userId: string, now = new Date()): Promise<StalledTask[]> {
  const tasks = await prisma.task.findMany({
    where: { userId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } },
    orderBy: { updatedAt: 'asc' },
    take: 200,
  })
  const stalled: StalledTask[] = []
  for (const task of tasks) {
    const days = Math.floor((now.getTime() - task.updatedAt.getTime()) / 86_400_000)
    if (task.status === 'waiting' && days >= 3) {
      stalled.push({
        id: task.id,
        title: task.title,
        reason: `Ждём ответа ${task.waitingOn ?? 'кого-то'} уже ${days} дн.`,
        days,
      })
    } else if (days >= 10) {
      stalled.push({ id: task.id, title: task.title, reason: `Без движения ${days} дн.`, days })
    } else if (task.deferCount >= 3) {
      stalled.push({
        id: task.id,
        title: task.title,
        reason: `Переносилась ${task.deferCount} раз(а) — пересмотреть.`,
        days,
      })
    }
  }
  return stalled.slice(0, 25)
}

export async function findDuplicateGroups(userId: string) {
  const tasks = await prisma.task.findMany({
    where: { userId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } },
    select: { id: true, title: true, createdAt: true },
    take: 300,
  })
  const groups: { keepId: string; keepTitle: string; duplicates: { id: string; title: string }[] }[] = []
  const seen = new Set<string>()

  for (let i = 0; i < tasks.length; i += 1) {
    const base = tasks[i]
    if (!base || seen.has(base.id)) continue
    const duplicates: { id: string; title: string }[] = []
    for (let j = i + 1; j < tasks.length; j += 1) {
      const other = tasks[j]
      if (!other || seen.has(other.id)) continue
      if (titleSimilarity(base.title, other.title) >= DUPLICATE_THRESHOLD) {
        duplicates.push({ id: other.id, title: other.title })
        seen.add(other.id)
      }
    }
    if (duplicates.length > 0) {
      seen.add(base.id)
      groups.push({ keepId: base.id, keepTitle: base.title, duplicates })
    }
  }
  return groups
}

/** Merges duplicates into `keepId`. Reversible: duplicates are soft-deleted. */
export async function mergeDuplicates(
  userId: string,
  keepId: string,
  mergeIds: string[],
): Promise<number> {
  const merged = await prisma.task.updateMany({
    where: { userId, id: { in: mergeIds }, deletedAt: null },
    data: { deletedAt: new Date(), status: 'cancelled', description: `Объединена с задачей ${keepId}` },
  })
  await recordAudit({
    userId,
    actor: 'agent:task',
    action: 'update',
    entityType: 'Task',
    entityId: keepId,
    after: { mergedIds: mergeIds },
  })
  return merged.count
}

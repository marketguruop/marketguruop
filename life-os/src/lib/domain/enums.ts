import { z } from 'zod'

/**
 * Enum-like values live here as Zod unions rather than Prisma enums so the
 * schema stays portable between SQLite and PostgreSQL.
 */

export const TaskStatus = z.enum([
  'inbox',
  'clarification',
  'planned',
  'in_progress',
  'waiting',
  'delegated',
  'completed',
  'cancelled',
  'idea',
])
export type TaskStatus = z.infer<typeof TaskStatus>

export const OPEN_TASK_STATUSES: TaskStatus[] = [
  'inbox',
  'clarification',
  'planned',
  'in_progress',
  'waiting',
  'delegated',
]

export const Priority = z.enum(['critical', 'high', 'medium', 'low', 'someday'])
export type Priority = z.infer<typeof Priority>

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 1,
  high: 0.78,
  medium: 0.5,
  low: 0.28,
  someday: 0.08,
}

export const EnergyLevel = z.enum(['low', 'medium', 'high'])
export type EnergyLevel = z.infer<typeof EnergyLevel>

export const TaskContext = z.enum(['deep', 'admin', 'calls', 'errand', 'creative'])
export type TaskContext = z.infer<typeof TaskContext>

export const BlockKind = z.enum([
  'focus',
  'admin',
  'buffer',
  'travel',
  'prep',
  'meal',
  'sport',
  'recovery',
  'meeting',
])
export type BlockKind = z.infer<typeof BlockKind>

export const InboxItemType = z.enum([
  'task',
  'project',
  'event',
  'idea',
  'content',
  'purchase',
  'contact',
  'finance',
  'health',
  'note',
  'trash',
])
export type InboxItemType = z.infer<typeof InboxItemType>

export const RiskLevel = z.enum(['safe', 'confirm', 'forbidden'])
export type RiskLevel = z.infer<typeof RiskLevel>

export const AgentKey = z.enum([
  'chief_of_staff',
  'inbox',
  'calendar',
  'task',
  'content',
  'business',
  'finance',
  'energy',
  'crm',
  'automation',
  'review',
])
export type AgentKey = z.infer<typeof AgentKey>

export const Platform = z.enum([
  'instagram',
  'reels',
  'stories',
  'tiktok',
  'threads',
  'telegram',
  'youtube',
])
export type Platform = z.infer<typeof Platform>

export const ContentPillar = z.enum([
  'work',
  'business',
  'beauty',
  'sport',
  'fame',
  'travel',
  'style',
  'money',
  'insight',
  'humor',
  'backstage',
])
export type ContentPillar = z.infer<typeof ContentPillar>

export const Source = z.enum(['manual', 'agent', 'telegram', 'google', 'import', 'planner', 'system'])
export type Source = z.infer<typeof Source>

/** Parses a JSON string column into a typed array, never throwing. */
export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/** Parses a JSON string column into a typed object, never throwing. */
export function parseJsonObject<T extends object = Record<string, unknown>>(
  raw: string | null | undefined,
  fallback: T,
): T {
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

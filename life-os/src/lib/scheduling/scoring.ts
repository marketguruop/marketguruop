import { PRIORITY_WEIGHT, type EnergyLevel, type Priority, type TaskContext } from '@/lib/domain/enums'
import { daysUntil } from '@/lib/dates'

/**
 * Placement scoring. Pure and dependency-free so it can be unit-tested and
 * reasoned about without a database. Every factor is normalised to 0..1 and
 * combined with the weights below; weights sum to exactly 1.
 */

export const SCORING_WEIGHTS = {
  deadlineUrgency: 0.24,
  priority: 0.18,
  strategicValue: 0.12,
  incomeImpact: 0.11,
  mediaImpact: 0.07,
  healthImpact: 0.05,
  energyMatch: 0.09,
  contextMatch: 0.04,
  durationFit: 0.05,
  dependency: 0.05,
} as const

export type ScoringFactor = keyof typeof SCORING_WEIGHTS

/** Each additional deferral costs this much score, capped at MAX_DEFERS. */
export const DEFER_PENALTY_PER_STEP = 0.05
export const MAX_DEFERS = 3

export interface ScorableTask {
  id: string
  priority: Priority
  deadline?: Date | null
  estimatedMinutes: number
  energy: EnergyLevel
  context?: TaskContext | null
  /** 0..1 — how much this moves a stated goal forward. */
  strategicValue?: number
  /** 0..1 — direct revenue effect. */
  incomeImpact?: number
  /** 0..1 — personal-brand / media effect. */
  mediaImpact?: number
  /** 0..1 — health effect. */
  healthImpact?: number
  /** How many other tasks are blocked by this one. */
  blockingCount?: number
  /** True when this task has an unresolved dependency and cannot start. */
  blocked?: boolean
  deferCount?: number
}

export interface ScoringSlot {
  start: Date
  /** Energy the user is expected to have in this slot. */
  energy: EnergyLevel
  context?: TaskContext | null
  availableMinutes: number
}

export type ScoreFactors = Record<ScoringFactor, number>

export interface ScoreResult {
  total: number
  factors: ScoreFactors
  penalty: number
  eligible: boolean
  reason: string
}

const ENERGY_RANK: Record<EnergyLevel, number> = { low: 1, medium: 2, high: 3 }

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export function deadlineUrgency(deadline: Date | null | undefined, now: Date): number {
  if (!deadline) return 0.3
  const days = daysUntil(deadline, now)
  if (days <= 0) return 1
  return clamp01(1 / (1 + days / 3))
}

export function energyMatch(taskEnergy: EnergyLevel, slotEnergy: EnergyLevel): number {
  const diff = ENERGY_RANK[slotEnergy] - ENERGY_RANK[taskEnergy]
  // Slot richer than needed is fine (small waste); slot poorer than needed is bad.
  return diff >= 0 ? clamp01(1 - diff * 0.15) : clamp01(1 + diff * 0.45)
}

export function contextMatch(
  taskContext: TaskContext | null | undefined,
  slotContext: TaskContext | null | undefined,
): number {
  if (!taskContext || !slotContext) return 0.5
  return taskContext === slotContext ? 1 : 0.2
}

export function durationFit(estimatedMinutes: number, availableMinutes: number): number {
  if (availableMinutes <= 0) return 0
  if (estimatedMinutes > availableMinutes) return 0
  // Prefer slots the task nearly fills, so we don't fragment long windows.
  return clamp01(0.55 + 0.45 * (estimatedMinutes / availableMinutes))
}

export function dependencyScore(blockingCount: number): number {
  return clamp01(blockingCount / 3)
}

export function scoreTask(task: ScorableTask, slot: ScoringSlot, now: Date = new Date()): ScoreResult {
  const factors: ScoreFactors = {
    deadlineUrgency: deadlineUrgency(task.deadline ?? null, now),
    priority: PRIORITY_WEIGHT[task.priority],
    strategicValue: clamp01(task.strategicValue ?? 0.4),
    incomeImpact: clamp01(task.incomeImpact ?? 0.2),
    mediaImpact: clamp01(task.mediaImpact ?? 0.2),
    healthImpact: clamp01(task.healthImpact ?? 0.2),
    energyMatch: energyMatch(task.energy, slot.energy),
    contextMatch: contextMatch(task.context ?? null, slot.context ?? null),
    durationFit: durationFit(task.estimatedMinutes, slot.availableMinutes),
    dependency: dependencyScore(task.blockingCount ?? 0),
  }

  let total = 0
  for (const key of Object.keys(SCORING_WEIGHTS) as ScoringFactor[]) {
    total += SCORING_WEIGHTS[key] * factors[key]
  }

  const penalty = Math.min(task.deferCount ?? 0, MAX_DEFERS) * DEFER_PENALTY_PER_STEP
  total = clamp01(total - penalty)

  if (task.blocked) {
    return { total: 0, factors, penalty, eligible: false, reason: 'Заблокирована зависимостью' }
  }
  if (factors.durationFit === 0) {
    return { total: 0, factors, penalty, eligible: false, reason: 'Не помещается в окно' }
  }

  return { total, factors, penalty, eligible: true, reason: explain(factors, penalty) }
}

function explain(factors: ScoreFactors, penalty: number): string {
  const ranked = (Object.keys(factors) as ScoringFactor[])
    .map((key) => ({ key, contribution: SCORING_WEIGHTS[key] * factors[key] }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2)
    .map(({ key }) => FACTOR_LABEL[key])
  const base = `Главные факторы: ${ranked.join(', ')}`
  return penalty > 0 ? `${base}; штраф за переносы −${penalty.toFixed(2)}` : base
}

export const FACTOR_LABEL: Record<ScoringFactor, string> = {
  deadlineUrgency: 'дедлайн',
  priority: 'приоритет',
  strategicValue: 'стратегическая ценность',
  incomeImpact: 'влияние на доход',
  mediaImpact: 'влияние на медиа',
  healthImpact: 'влияние на здоровье',
  energyMatch: 'совпадение по энергии',
  contextMatch: 'совпадение по контексту',
  durationFit: 'длительность',
  dependency: 'разблокирует другие задачи',
}

/** After MAX_DEFERS the task must be deleted, delegated or rewritten — not moved again. */
export function needsDeferReview(deferCount: number): boolean {
  return deferCount >= MAX_DEFERS
}

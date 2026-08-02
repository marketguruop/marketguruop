import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { rateLimit } from '@/lib/rate-limit'
import { classifyAction } from '@/lib/approvals/policy'
import type { AgentKey } from '@/lib/domain/enums'

/** Guard rails so an agent loop can never run away in steps or in cost. */
export class AgentLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentLimitError'
  }
}

export interface RunHandle {
  id: string
  userId: string
  agentKey: AgentKey
  steps: number
  costUsd: number
}

export async function startRun(input: {
  userId: string
  agentKey: AgentKey
  trigger?: string
  input: string
  parentRunId?: string | null
}): Promise<RunHandle> {
  const limits = env()
  const gate = rateLimit(`ai:${input.userId}`, limits.AI_MAX_RUNS_PER_HOUR, 3_600_000)
  if (!gate.allowed) {
    throw new AgentLimitError(
      `Достигнут лимит запусков агентов в час (${limits.AI_MAX_RUNS_PER_HOUR}). Повтори позже.`,
    )
  }

  const agent = await prisma.agent.findUnique({ where: { key: input.agentKey } })
  const run = await prisma.agentRun.create({
    data: {
      userId: input.userId,
      agentId: agent?.id ?? null,
      agentKey: input.agentKey,
      trigger: input.trigger ?? 'manual',
      input: input.input.slice(0, 8000),
      parentRunId: input.parentRunId ?? null,
    },
  })

  return { id: run.id, userId: input.userId, agentKey: input.agentKey, steps: 0, costUsd: 0 }
}

export function assertStepAllowed(handle: RunHandle, maxSteps?: number): void {
  const limits = env()
  const cap = maxSteps ?? limits.AI_MAX_STEPS
  if (handle.steps >= cap) {
    throw new AgentLimitError(`Превышен лимит шагов агента (${cap}).`)
  }
  if (handle.costUsd >= limits.AI_MAX_COST_USD_PER_RUN) {
    throw new AgentLimitError(
      `Превышен лимит стоимости одного запуска ($${limits.AI_MAX_COST_USD_PER_RUN}).`,
    )
  }
}

export function chargeRun(handle: RunHandle, costUsd: number): void {
  handle.steps += 1
  handle.costUsd += costUsd
}

export interface ActionInput {
  kind: string
  entityType?: string
  entityId?: string
  payload?: Record<string, unknown>
  status?: 'applied' | 'pending_approval' | 'rejected' | 'failed' | 'skipped'
  reason?: string
}

export async function recordAction(handle: RunHandle, action: ActionInput): Promise<void> {
  await prisma.agentAction.create({
    data: {
      runId: handle.id,
      agentKey: handle.agentKey,
      kind: action.kind,
      entityType: action.entityType ?? null,
      entityId: action.entityId ?? null,
      payload: JSON.stringify(action.payload ?? {}),
      riskLevel: classifyAction(action.kind),
      status: action.status ?? 'applied',
      reason: action.reason ?? null,
    },
  })
}

export async function finishRun(
  handle: RunHandle,
  result: {
    status: 'succeeded' | 'failed' | 'cancelled'
    output?: string
    inputTokens?: number
    outputTokens?: number
    error?: string
  },
): Promise<void> {
  await prisma.agentRun.update({
    where: { id: handle.id },
    data: {
      status: result.status,
      output: result.output?.slice(0, 8000) ?? null,
      steps: handle.steps,
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
      costUsd: handle.costUsd,
      error: result.error ?? null,
      finishedAt: new Date(),
    },
  })
}

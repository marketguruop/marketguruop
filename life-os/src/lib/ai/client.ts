import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env, hasAnthropic } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('ai/client')

/** Thrown when no API key is configured. Callers fall back to deterministic logic. */
export class AiUnavailableError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured')
    this.name = 'AiUnavailableError'
  }
}

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiOutputError'
  }
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!hasAnthropic()) throw new AiUnavailableError()
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY })
  return client
}

/** USD per million tokens, keyed by model id. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? PRICING['claude-opus-5']
  if (!price) return 0
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

export interface StructuredCallOptions<T> {
  system: string
  prompt: string
  /** JSON Schema handed to the API so the model cannot return free-form text. */
  jsonSchema: Record<string, unknown>
  /**
   * Zod parser mirroring the JSON Schema — the second line of defence.
   * The input side is `unknown` (it is parsed JSON), which also keeps `T`
   * bound to the schema's *output* type when `.default()` is used.
   */
  parser: z.ZodType<T, z.ZodTypeDef, unknown>
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  model?: string
}

export interface StructuredCallResult<T> {
  data: T
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

/**
 * Single structured call to Claude. Never returns free-form text: the response is
 * schema-constrained by the API and re-validated with Zod before use.
 */
export async function callStructured<T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> {
  const config = env()
  const model = options.model ?? config.ANTHROPIC_MODEL
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens ?? 8000,
    system: options.system,
    output_config: {
      effort: options.effort ?? config.ANTHROPIC_EFFORT,
      format: { type: 'json_schema', schema: options.jsonSchema },
    },
    messages: [{ role: 'user', content: options.prompt }],
  })

  if (response.stop_reason === 'refusal') {
    throw new AiOutputError('Модель отклонила запрос по политике безопасности.')
  }

  const text = response.content.find((block) => block.type === 'text')
  if (!text || text.type !== 'text') {
    throw new AiOutputError('Ответ модели не содержит текстового блока.')
  }

  let raw: unknown
  try {
    raw = JSON.parse(text.text)
  } catch {
    throw new AiOutputError('Ответ модели не является валидным JSON.')
  }

  const parsed = options.parser.safeParse(raw)
  if (!parsed.success) {
    log.warn('schema mismatch', { issues: parsed.error.issues.slice(0, 5) })
    throw new AiOutputError(
      `Ответ модели не соответствует схеме: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    )
  }

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens

  return {
    data: parsed.data,
    model,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
  }
}

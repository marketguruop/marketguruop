import { z } from 'zod'

/**
 * Environment access. Everything optional except DATABASE_URL and AUTH_SECRET —
 * the app must boot (and be demoable) without any external integration configured.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  AUTH_SECRET: z.string().min(16).default('dev-only-insecure-secret-change-me'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
  ANTHROPIC_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('high'),
  AI_MAX_STEPS: z.coerce.number().int().positive().default(6),
  AI_MAX_COST_USD_PER_RUN: z.coerce.number().positive().default(1.5),
  AI_MAX_RUNS_PER_HOUR: z.coerce.number().int().positive().default(60),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_ID: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  APP_URL: z.string().default('http://localhost:3000'),
  DEFAULT_TIMEZONE: z.string().default('Europe/Helsinki'),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  cached = parsed.data
  return cached
}

export function hasAnthropic(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY)
}

export function hasTelegram(): boolean {
  return Boolean(env().TELEGRAM_BOT_TOKEN)
}

export function hasGoogleCalendar(): boolean {
  const e = env()
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REDIRECT_URI)
}

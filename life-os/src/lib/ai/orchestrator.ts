import { AGENTS } from '@/lib/ai/registry'
import { buildDailyBrief } from '@/lib/ai/agents/chief-of-staff'
import { captureAndProcess } from '@/lib/ai/agents/inbox-agent'
import { isSpecialist, runSpecialist } from '@/lib/ai/agents/specialists'
import { localDateKey } from '@/lib/dates'
import type { AgentKey } from '@/lib/domain/enums'

/**
 * The Chief of Staff decides which specialised agent handles a request.
 * Routing is deterministic keyword matching rather than a model call: it is
 * instant, free, and cannot hallucinate a destination.
 */
/** `\b` is ASCII-only in JS, so Cyrillic keywords need a Unicode lookbehind. */
function keywords(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})`, 'iu')
}

// Specialists are matched first; the Chief of Staff is the planning fallback,
// otherwise "контент на неделю" would be routed on the word "неделю".
const ROUTES: { agent: AgentKey; test: RegExp }[] = [
  { agent: 'content', test: keywords('контент|reels?|рилс|сторис|тикток|youtube|съ[её]мк|публикац') },
  { agent: 'finance', test: keywords('деньги|доход|заработа|расход|сч[её]т|инвойс|бюджет|подписк') },
  { agent: 'crm', test: keywords('контакт|follow.?up|договор[её]нност|кому\\s+нужно\\s+ответить') },
  { agent: 'energy', test: keywords('сон|сна|энерги|устал|тренировк|восстановлен') },
  { agent: 'business', test: keywords('проект|клиент|команд|отч[её]т|бренд\\s?бук|стратеги') },
  { agent: 'automation', test: keywords('автоматизир|автоматизац|рутин|повторяет|zapier|make|webhook') },
  { agent: 'task', test: keywords('задач|дубл|зависш|делегир') },
  { agent: 'chief_of_staff', test: keywords('план\\s+дня|план\\s+на\\s+день|брифинг|итог\\s+дня|недел[юияе]|приоритет|что\\s+сегодня') },
]

export function selectAgent(input: string): AgentKey {
  for (const route of ROUTES) {
    if (route.test.test(input)) return route.agent
  }
  // Anything that is not a recognised question is treated as raw capture.
  return 'inbox'
}

export interface OrchestratorResult {
  agentKey: AgentKey
  agentName: string
  text: string
  data?: unknown
  usedAi: boolean
}

/** Entry point used by the UI command palette and the Telegram bot. */
export async function routeRequest(
  userId: string,
  timezone: string,
  input: string,
): Promise<OrchestratorResult> {
  const agentKey = selectAgent(input)
  const definition = AGENTS[agentKey]

  if (agentKey === 'inbox') {
    const result = await captureAndProcess({ userId, rawText: input, channel: 'web' })
    const lines = [
      result.summary,
      ...result.created.map((c) => `+ ${c.type}: ${c.title}${c.note ? ` — ${c.note}` : ''}`),
      ...result.skipped.map((s) => `· пропущено: ${s.title} (${s.reason})`),
      ...result.needsClarification.map((q) => `? ${q}`),
    ]
    return {
      agentKey,
      agentName: definition.name,
      text: lines.join('\n'),
      data: result,
      usedAi: result.usedAi,
    }
  }

  if (agentKey === 'chief_of_staff') {
    const dateKey = localDateKey(new Date(), timezone)
    const brief = await buildDailyBrief(userId, dateKey, timezone)
    const lines = [
      brief.brief.headline,
      `Главная задача: ${brief.brief.mainGoal}`,
      ...brief.brief.outcomes.map((o, index) => `${index + 1}. ${o}`),
      ...(brief.brief.risks.length > 0 ? ['', 'Риски:', ...brief.brief.risks.map((r) => `- ${r}`)] : []),
      '',
      brief.brief.closingNote,
    ]
    return {
      agentKey,
      agentName: definition.name,
      text: lines.join('\n'),
      data: brief,
      usedAi: brief.usedAi,
    }
  }

  if (isSpecialist(agentKey)) {
    const result = await runSpecialist(userId, agentKey, timezone, input)
    const lines = [
      result.summary,
      ...result.findings.map((f) => `[${f.severity}] ${f.title}: ${f.detail}`),
      ...result.created.map((c) => `+ ${c.type}: ${c.title}${c.note ? ` — ${c.note}` : ''}`),
      ...result.skipped.map((s) => `· пропущено: ${s.title} (${s.reason})`),
    ]
    return {
      agentKey,
      agentName: definition.name,
      text: lines.join('\n'),
      data: result,
      usedAi: result.usedAi,
    }
  }

  // Calendar, task and review agents are driven from their own screens rather
  // than free text; routing here would give the user nothing to act on.
  return {
    agentKey,
    agentName: definition.name,
    text: `Агент «${definition.name}» работает из своего раздела, а не из свободного запроса.`,
    usedAi: false,
  }
}

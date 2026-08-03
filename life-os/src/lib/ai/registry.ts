import type { AgentKey } from '@/lib/domain/enums'
import { CHIEF_OF_STAFF_PROMPT } from '@/lib/ai/prompts/chief-of-staff'
import { INBOX_PROMPT } from '@/lib/ai/prompts/inbox'
import { CALENDAR_PROMPT } from '@/lib/ai/prompts/calendar'
import { TASK_PROMPT } from '@/lib/ai/prompts/task'
import { CONTENT_PROMPT } from '@/lib/ai/prompts/content'
import { BUSINESS_PROMPT } from '@/lib/ai/prompts/business'
import { FINANCE_PROMPT } from '@/lib/ai/prompts/finance'
import { ENERGY_PROMPT } from '@/lib/ai/prompts/energy'
import { CRM_PROMPT } from '@/lib/ai/prompts/crm'
import { AUTOMATION_PROMPT } from '@/lib/ai/prompts/automation'
import { REVIEW_PROMPT } from '@/lib/ai/prompts/review'

export interface AgentDefinition {
  key: AgentKey
  name: string
  description: string
  systemPrompt: string
  /** How the agent acts: writes rows itself, or coordinates other agents. */
  mode: 'core' | 'advisory'
  maxSteps: number
}

export const AGENTS: Record<AgentKey, AgentDefinition> = {
  chief_of_staff: {
    key: 'chief_of_staff',
    name: 'Chief of Staff',
    description: 'Координирует агентов, определяет приоритеты и собирает план дня и недели.',
    systemPrompt: CHIEF_OF_STAFF_PROMPT,
    mode: 'core',
    maxSteps: 6,
  },
  inbox: {
    key: 'inbox',
    name: 'Inbox Agent',
    description: 'Разбирает голосовые расшифровки, заметки и хаотичные мысли на сущности.',
    systemPrompt: INBOX_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  calendar: {
    key: 'calendar',
    name: 'Calendar Agent',
    description: 'Строит расписание, находит окна и конфликты, предлагает time blocks.',
    systemPrompt: CALENDAR_PROMPT,
    mode: 'core',
    maxSteps: 3,
  },
  task: {
    key: 'task',
    name: 'Task & Project Manager',
    description: 'Объединяет дубли, формулирует следующие шаги, находит зависшие задачи.',
    systemPrompt: TASK_PROMPT,
    mode: 'core',
    maxSteps: 3,
  },
  review: {
    key: 'review',
    name: 'Review & Quality Agent',
    description: 'Проверяет действия остальных агентов на дубли, конфликты и перегрузку.',
    systemPrompt: REVIEW_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  content: {
    key: 'content',
    name: 'Content Director',
    description: 'Превращает реальную жизнь в контент-план, хуки и сценарии.',
    systemPrompt: CONTENT_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  business: {
    key: 'business',
    name: 'Business & Marketing Agent',
    description: 'Ведёт рабочие проекты, ТЗ команде, отчёты и риски.',
    systemPrompt: BUSINESS_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  finance: {
    key: 'finance',
    name: 'Finance Agent',
    description: 'Доходы, расходы, ожидаемые платежи, кассовые разрывы и подписки.',
    systemPrompt: FINANCE_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  energy: {
    key: 'energy',
    name: 'Energy & Routine Agent',
    description: 'Сон, тренировки, энергия, привычки и минимальная версия дня.',
    systemPrompt: ENERGY_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  crm: {
    key: 'crm',
    name: 'Contacts & CRM Agent',
    description: 'Контакты, договорённости, follow-up и черновики сообщений.',
    systemPrompt: CRM_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
  automation: {
    key: 'automation',
    name: 'Automation Agent',
    description: 'Ищет повторяющиеся действия и собирает сценарии автоматизации.',
    systemPrompt: AUTOMATION_PROMPT,
    mode: 'core',
    maxSteps: 2,
  },
}

export const AGENT_LIST: AgentDefinition[] = Object.values(AGENTS)

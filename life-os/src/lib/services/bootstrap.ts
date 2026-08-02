import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger('bootstrap')

const AGENTS: [string, string, string][] = [
  ['chief_of_staff', 'Chief of Staff', 'Координирует агентов и собирает план дня и недели.'],
  ['inbox', 'Inbox Agent', 'Разбирает входящие записи на задачи, события и идеи.'],
  ['calendar', 'Calendar Agent', 'Строит расписание и находит конфликты.'],
  ['task', 'Task & Project Manager', 'Дубли, следующие шаги, зависшие задачи.'],
  ['review', 'Review & Quality Agent', 'Проверяет действия других агентов.'],
  ['content', 'Content Director', 'Контент-план, хуки, сценарии.'],
  ['business', 'Business & Marketing Agent', 'Рабочие проекты, ТЗ, отчёты.'],
  ['finance', 'Finance Agent', 'Доходы, расходы, счета.'],
  ['energy', 'Energy & Routine Agent', 'Сон, энергия, тренировки.'],
  ['crm', 'Contacts & CRM Agent', 'Контакты и follow-up.'],
  ['automation', 'Automation Agent', 'Сценарии автоматизации.'],
]

const AREAS: [string, string][] = [
  ['Бизнес и проекты', '#B98A6E'],
  ['Личный бренд и контент', '#C9748A'],
  ['Здоровье и спорт', '#6E9B8A'],
  ['Деньги', '#8A7FB5'],
  ['Личное', '#A8A29E'],
]

const RULES: [string, string, 'rule' | 'preference'][] = [
  ['Правило календаря', 'Не больше 75% занятого времени, минимум 25% резерва', 'rule'],
  ['Правило спорта', 'Бег и тяжёлая силовая — не в один день', 'rule'],
  ['Предпочтение по фокусу', 'Сложную работу ставить до 12:00', 'preference'],
  ['Тон коммуникации', 'Коротко, по делу, без канцелярита', 'preference'],
]

export interface BootstrapResult {
  createdUser: boolean
  userId: string
  agents: number
  areas: number
  memories: number
}

/**
 * Idempotent first-run setup for a hosted deployment, where there is no shell
 * to run `npm run db:seed`. Creates the account, the agent registry, default
 * areas and the baseline rules — and nothing else: this is the user's real
 * system, not a demo, so no fake projects or invented numbers.
 */
export async function bootstrap(input: {
  email: string
  password: string
  name?: string
  timezone?: string
}): Promise<BootstrapResult> {
  const email = input.email.toLowerCase().trim()

  for (const [key, name, description] of AGENTS) {
    await prisma.agent.upsert({
      where: { key },
      create: { key, name, description },
      update: { name, description },
    })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        name: input.name ?? 'Эмилия',
        passwordHash: hashPassword(input.password),
        timezone: input.timezone ?? 'Europe/Helsinki',
        preferences: JSON.stringify({
          workStartMinute: 9 * 60,
          workEndMinute: 21 * 60,
          maxUtilization: 0.75,
        }),
      },
    }))

  let areas = 0
  const areaCount = await prisma.area.count({ where: { userId: user.id, deletedAt: null } })
  if (areaCount === 0) {
    for (const [name, color] of AREAS) {
      await prisma.area.create({ data: { userId: user.id, name, color } })
      areas += 1
    }
  }

  let memories = 0
  for (const [key, value, category] of RULES) {
    await prisma.memoryEntry.upsert({
      where: { userId_layer_key: { userId: user.id, layer: 'long', key } },
      create: { userId: user.id, layer: 'long', key, value, category, weight: 1.5 },
      update: {},
    })
    memories += 1
  }

  log.info('bootstrap complete', { userId: user.id, createdUser: !existing })

  return {
    createdUser: !existing,
    userId: user.id,
    agents: AGENTS.length,
    areas,
    memories,
  }
}

import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes, scryptSync } from 'node:crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

const TZ = 'Europe/Helsinki'
const EMAIL = process.env.SEED_EMAIL ?? 'emiliya.shramkoo@gmail.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'lifeos123'

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

function dayOnly(dayOffset: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return d
}

const AGENTS = [
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
] as const

async function main(): Promise<void> {
  console.log('Seeding EMILIYA LIFE OS…')

  for (const [key, name, description] of AGENTS) {
    await prisma.agent.upsert({
      where: { key },
      create: { key, name, description },
      update: { name, description },
    })
  }

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      name: 'Эмилия',
      passwordHash: hashPassword(PASSWORD),
      timezone: TZ,
      preferences: JSON.stringify({
        workStartMinute: 9 * 60,
        workEndMinute: 21 * 60,
        maxUtilization: 0.75,
      }),
    },
    update: {},
  })

  // Re-seeding replaces demo content but keeps the account and its sessions.
  await prisma.$transaction([
    prisma.timeBlock.deleteMany({ where: { userId: user.id } }),
    prisma.subtask.deleteMany({ where: { task: { userId: user.id } } }),
    prisma.followUp.deleteMany({ where: { userId: user.id } }),
    prisma.publication.deleteMany({ where: { userId: user.id } }),
    prisma.contentItem.deleteMany({ where: { userId: user.id } }),
    prisma.contentIdea.deleteMany({ where: { userId: user.id } }),
    prisma.task.deleteMany({ where: { userId: user.id } }),
    prisma.calendarEvent.deleteMany({ where: { userId: user.id } }),
    prisma.invoice.deleteMany({ where: { userId: user.id } }),
    prisma.income.deleteMany({ where: { userId: user.id } }),
    prisma.expense.deleteMany({ where: { userId: user.id } }),
    prisma.contactProject.deleteMany({ where: { project: { userId: user.id } } }),
    prisma.contact.deleteMany({ where: { userId: user.id } }),
    prisma.project.deleteMany({ where: { userId: user.id } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.area.deleteMany({ where: { userId: user.id } }),
    prisma.habitLog.deleteMany({ where: { userId: user.id } }),
    prisma.habit.deleteMany({ where: { userId: user.id } }),
    prisma.energyLog.deleteMany({ where: { userId: user.id } }),
    prisma.sleepLog.deleteMany({ where: { userId: user.id } }),
    prisma.workout.deleteMany({ where: { userId: user.id } }),
    prisma.automation.deleteMany({ where: { userId: user.id } }),
    prisma.memoryEntry.deleteMany({ where: { userId: user.id } }),
    prisma.inboxItem.deleteMany({ where: { userId: user.id } }),
    prisma.approvalRequest.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.note.deleteMany({ where: { userId: user.id } }),
  ])

  const areas = await Promise.all(
    [
      { name: 'Бизнес и проекты', color: '#B98A6E' },
      { name: 'Личный бренд и контент', color: '#C9748A' },
      { name: 'Здоровье и спорт', color: '#6E9B8A' },
      { name: 'Деньги', color: '#8A7FB5' },
      { name: 'Личное', color: '#A8A29E' },
    ].map((a) => prisma.area.create({ data: { ...a, userId: user.id } })),
  )
  const [business, brand, health, money] = areas

  const incomeGoal = await prisma.goal.create({
    data: {
      userId: user.id,
      areaId: money?.id,
      title: 'Доход 12 000 € в месяц',
      horizon: 'quarter',
      metric: 'income_eur_month',
      targetValue: 12000,
      currentValue: 7400,
      priority: 'critical',
      deadline: at(75, 12),
    },
  })

  const brandGoal = await prisma.goal.create({
    data: {
      userId: user.id,
      areaId: brand?.id,
      title: '100 000 подписчиков в Instagram',
      horizon: 'year',
      metric: 'followers',
      targetValue: 100000,
      currentValue: 41200,
      priority: 'high',
    },
  })

  const bumble = await prisma.project.create({
    data: {
      userId: user.id,
      areaId: business?.id,
      goalId: incomeGoal.id,
      name: 'Bumble Coffee',
      client: 'Bumble Coffee OY',
      goal: 'Запустить осеннюю кампанию и вырастить средний чек',
      nextAction: 'Согласовать медиаплан с командой',
      progress: 0.45,
      deadline: at(21, 18),
      priority: 'high',
      members: JSON.stringify(['Саша', 'Марина']),
      risks: 'Подрядчик по съёмке не подтвердил дату',
    },
  })

  const phoenix = await prisma.project.create({
    data: {
      userId: user.id,
      areaId: business?.id,
      goalId: incomeGoal.id,
      name: 'Black Phoenix',
      client: 'Black Phoenix',
      goal: 'Ребрендинг и новый сайт',
      nextAction: 'Отдать брендбук на вычитку',
      progress: 0.7,
      deadline: at(10, 18),
      priority: 'critical',
      members: JSON.stringify(['Ник']),
    },
  })

  const cider = await prisma.project.create({
    data: {
      userId: user.id,
      areaId: business?.id,
      name: 'Cider House',
      client: 'Cider House',
      goal: 'SMM-стратегия на квартал',
      nextAction: 'Собрать аналитику за прошлый месяц',
      progress: 0.2,
      deadline: at(35, 18),
      priority: 'medium',
    },
  })

  const personalBrand = await prisma.project.create({
    data: {
      userId: user.id,
      areaId: brand?.id,
      goalId: brandGoal.id,
      name: 'Personal Brand',
      goal: 'Регулярный контент 5 раз в неделю',
      nextAction: 'Снять три Reels про закулисье проектов',
      progress: 0.55,
      priority: 'high',
    },
  })

  const tasks = [
    { title: 'Согласовать медиаплан Bumble Coffee', projectId: bumble.id, priority: 'critical', energy: 'high', context: 'deep', estimatedMinutes: 60, deadline: at(1, 15) },
    { title: 'Вычитать брендбук Black Phoenix', projectId: phoenix.id, priority: 'high', energy: 'high', context: 'deep', estimatedMinutes: 90, deadline: at(2, 18) },
    { title: 'Написать Саше про съёмку', projectId: bumble.id, priority: 'high', energy: 'low', context: 'calls', estimatedMinutes: 15, deadline: at(0, 18) },
    { title: 'Собрать аналитику Cider House за месяц', projectId: cider.id, priority: 'medium', energy: 'medium', context: 'admin', estimatedMinutes: 45 },
    { title: 'Придумать три Reels про закулисье', projectId: personalBrand.id, priority: 'high', energy: 'high', context: 'creative', estimatedMinutes: 60 },
    { title: 'Выставить счёт Cider House', projectId: cider.id, priority: 'high', energy: 'low', context: 'admin', estimatedMinutes: 20, canAutomate: true },
    { title: 'Записаться к стоматологу', priority: 'medium', energy: 'low', context: 'errand', estimatedMinutes: 10, canDelegate: true },
    { title: 'Обновить портфолио на сайте', priority: 'low', energy: 'medium', context: 'creative', estimatedMinutes: 120 },
    { title: 'Разобрать почту и подписки', priority: 'low', energy: 'low', context: 'admin', estimatedMinutes: 30, canAutomate: true },
  ] as const

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: t.title,
        projectId: 'projectId' in t ? t.projectId : null,
        priority: t.priority,
        energy: t.energy,
        context: t.context,
        estimatedMinutes: t.estimatedMinutes,
        deadline: 'deadline' in t ? t.deadline : null,
        canAutomate: 'canAutomate' in t ? Boolean(t.canAutomate) : false,
        canDelegate: 'canDelegate' in t ? Boolean(t.canDelegate) : false,
        status: 'inbox',
        nextAction: `Начать: ${t.title.toLowerCase()}`,
      },
    })
  }

  await prisma.task.create({
    data: {
      userId: user.id,
      projectId: phoenix.id,
      title: 'Дождаться правок от Ника по логотипу',
      status: 'waiting',
      waitingOn: 'Ник',
      priority: 'high',
      energy: 'low',
      estimatedMinutes: 15,
      updatedAt: dayOnly(-6),
    },
  })

  await prisma.calendarEvent.createMany({
    data: [
      {
        userId: user.id,
        title: 'Созвон с командой Bumble Coffee',
        startsAt: at(0, 11),
        endsAt: at(0, 12),
        hasOtherPeople: true,
        attendees: JSON.stringify(['Саша', 'Марина']),
        prepMinutes: 15,
      },
      {
        userId: user.id,
        title: 'Съёмка контента в студии',
        location: 'Studio Kamppi, Helsinki',
        startsAt: at(1, 13),
        endsAt: at(1, 16),
        travelMinutes: 30,
        prepMinutes: 60,
        recoveryMinutes: 30,
        hasOtherPeople: true,
      },
      {
        userId: user.id,
        title: 'Встреча с Cider House',
        location: 'Cafe Regatta',
        startsAt: at(2, 10),
        endsAt: at(2, 11),
        travelMinutes: 25,
        hasOtherPeople: true,
      },
    ],
  })

  const idea = await prisma.contentIdea.create({
    data: {
      userId: user.id,
      projectId: personalBrand.id,
      title: 'Как выглядит день маркетолога с тремя проектами',
      hook: 'Три бренда, один день и ноль хаоса — показываю, как это устроено',
      pillar: 'backstage',
      platforms: JSON.stringify(['instagram', 'reels', 'tiktok']),
      priority: 'high',
    },
  })

  await prisma.contentItem.create({
    data: {
      userId: user.id,
      ideaId: idea.id,
      title: 'Reels: день с тремя проектами',
      platform: 'instagram',
      format: 'reels',
      script: 'Утро → созвон → студия → монтаж. Голос за кадром, динамичная нарезка.',
      shotList: JSON.stringify(['Кофе и ноутбук', 'Созвон', 'Студия', 'Вечерний монтаж']),
      shootAt: at(1, 13),
      publishAt: at(3, 18),
      status: 'planned',
    },
  })

  const sasha = await prisma.contact.create({
    data: {
      userId: user.id,
      name: 'Саша Ким',
      role: 'Продюсер съёмок',
      telegram: '@sashakim',
      lastContactAt: dayOnly(-4),
      tags: JSON.stringify(['съёмки', 'подрядчик']),
    },
  })
  await prisma.contactProject.create({ data: { contactId: sasha.id, projectId: bumble.id, role: 'Продюсер' } })
  await prisma.followUp.create({
    data: {
      userId: user.id,
      contactId: sasha.id,
      subject: 'Подтвердить дату съёмки',
      agreement: 'Саша обещал прислать варианты дат до конца недели',
      dueAt: at(1, 12),
      draftMessage: 'Саша, привет. Нужны финальные даты по съёмке — сможешь прислать сегодня?',
    },
  })

  await prisma.income.createMany({
    data: [
      { userId: user.id, projectId: bumble.id, title: 'Bumble Coffee — ретейнер', category: 'project', amount: 3500, status: 'received', receivedAt: dayOnly(-12) },
      { userId: user.id, projectId: phoenix.id, title: 'Black Phoenix — ребрендинг', category: 'project', amount: 3900, status: 'received', receivedAt: dayOnly(-5) },
      { userId: user.id, title: 'Рекламная интеграция', category: 'ads', amount: 1800, status: 'expected', expectedAt: at(9, 12) },
    ],
  })
  await prisma.expense.createMany({
    data: [
      { userId: user.id, title: 'Аренда студии', category: 'production', amount: 350, spentAt: dayOnly(-3), status: 'paid' },
      { userId: user.id, title: 'Подписка на монтаж', category: 'software', amount: 39, isSubscription: true, isRecurring: true, status: 'paid' },
      { userId: user.id, title: 'Подписка на сток-фото', category: 'software', amount: 29, isSubscription: true, isRecurring: true, status: 'paid' },
    ],
  })
  await prisma.invoice.create({
    data: {
      userId: user.id,
      projectId: cider.id,
      counterparty: 'Cider House',
      number: 'INV-2026-014',
      amount: 2400,
      issuedAt: dayOnly(-9),
      dueAt: at(-2, 12),
      status: 'unpaid',
    },
  })

  const habit = await prisma.habit.create({
    data: { userId: user.id, name: 'Утренняя зарядка', targetPerWeek: 5 },
  })
  for (let i = 1; i <= 5; i += 1) {
    await prisma.habitLog.create({
      data: { userId: user.id, habitId: habit.id, date: dayOnly(-i), done: i % 4 !== 0 },
    })
  }
  for (let i = 0; i <= 6; i += 1) {
    await prisma.energyLog.create({
      data: { userId: user.id, date: dayOnly(-i), level: [4, 3, 5, 2, 4, 3, 4][i] ?? 3 },
    })
    await prisma.sleepLog.create({
      data: { userId: user.id, date: dayOnly(-i), hours: [7.5, 6, 8, 5.5, 7, 7.5, 8][i] ?? 7, quality: 3 },
    })
  }
  await prisma.workout.createMany({
    data: [
      { userId: user.id, date: dayOnly(-1), kind: 'run', intensity: 'medium', minutes: 40, status: 'done' },
      { userId: user.id, date: dayOnly(0), kind: 'strength', intensity: 'high', minutes: 60, status: 'planned' },
    ],
  })

  await prisma.automation.create({
    data: {
      userId: user.id,
      name: 'Счёт клиенту в конце месяца',
      description: 'Черновик счёта по каждому активному ретейнеру в последний рабочий день месяца.',
      trigger: 'schedule',
      triggerConfig: JSON.stringify({ cron: '0 9 28 * *' }),
      actions: JSON.stringify([{ kind: 'create_task', title: 'Выставить счёт' }]),
      integration: 'google_sheets',
      savedMinutesPerWeek: 25,
      riskLevel: 'low',
      status: 'draft',
    },
  })

  await prisma.memoryEntry.createMany({
    data: [
      { userId: user.id, layer: 'long', key: 'Главная цель квартала', value: 'Доход 12 000 € в месяц', category: 'goal', weight: 2 },
      { userId: user.id, layer: 'long', key: 'Правило календаря', value: 'Не больше 75% занятого времени, минимум 25% резерва', category: 'rule', weight: 2 },
      { userId: user.id, layer: 'long', key: 'Правило спорта', value: 'Бег и тяжёлая силовая — не в один день', category: 'rule', weight: 1.5 },
      { userId: user.id, layer: 'long', key: 'Предпочтение по фокусу', value: 'Сложную работу ставить до 12:00', category: 'preference', weight: 1.5 },
      { userId: user.id, layer: 'long', key: 'Тон коммуникации', value: 'Коротко, по делу, без канцелярита', category: 'preference', weight: 1 },
    ],
  })

  await prisma.inboxItem.create({
    data: {
      userId: user.id,
      rawText: 'Завтра нужно написать Саше, договориться о съёмке и придумать три Reels',
      channel: 'telegram',
    },
  })

  console.log(`Готово. Вход: ${EMAIL} / ${PASSWORD}`)
  console.log(`Хеш пароля проверен: ${createHash('sha256').update(EMAIL).digest('hex').slice(0, 8)}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })

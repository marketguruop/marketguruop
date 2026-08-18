import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildDayPlan } from '@/lib/services/plan'
import { reviewPlan } from '@/lib/ai/agents/review-agent'
import { loadDashboardSnapshot } from '@/lib/ai/agents/chief-of-staff'
import { dayBounds, formatRuDate, localDateKey, localTimeLabel } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Row, Stat } from '@/components/ui'
import { QuickCapture } from '@/components/quick-capture'
import { ApplyPlanButton } from '@/components/actions'
import { formatMoney } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const now = new Date()
  const todayKey = localDateKey(now, user.timezone)
  const { start, end } = dayBounds(todayKey, user.timezone)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [plan, snapshot, nextEvent, deadlines] = await Promise.all([
    buildDayPlan(user.id, todayKey, user.timezone, now),
    loadDashboardSnapshot(user.id, monthStart, start, end),
    prisma.calendarEvent.findFirst({
      where: { userId: user.id, deletedAt: null, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        status: { in: ['inbox', 'clarification', 'planned', 'in_progress'] },
        deadline: { not: null, lte: new Date(now.getTime() + 7 * 86_400_000) },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
  ])

  const findings = await reviewPlan(user.id, plan, now)
  const mainBlock = plan.blocks.find((b) => b.taskId && b.taskId === plan.mainTaskId)
  const schedule = plan.blocks.filter((b) => b.kind !== 'buffer').slice(0, 6)
  const load = Math.round(plan.utilization * 100)

  return (
    <>
      <PageHeader
        title={formatRuDate(now, user.timezone)}
        subtitle={`Загрузка дня ${load}% при лимите 75% · свободно ${plan.freeMinutes} мин`}
        action={<ApplyPlanButton date={todayKey} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Главная задача" value={mainBlock ? '1' : '—'} hint={mainBlock?.title ?? 'Не выбрана'} />
        <Stat
          label="Открытых задач"
          value={snapshot.openTasks}
          hint={snapshot.overdue > 0 ? `${snapshot.overdue} просрочено` : 'Без просрочек'}
          tone={snapshot.overdue > 0 ? 'alert' : 'neutral'}
        />
        <Stat
          label="Доход за месяц"
          value={formatMoney(snapshot.monthIncome)}
          hint={snapshot.monthGoal > 0 ? `Цель ${formatMoney(snapshot.monthGoal)}` : 'Цель не задана'}
        />
        <Stat
          label="Ждут подтверждения"
          value={snapshot.pendingApprovals}
          hint={snapshot.inboxPending > 0 ? `${snapshot.inboxPending} во входящих` : 'Входящие разобраны'}
          tone={snapshot.pendingApprovals > 0 ? 'accent' : 'neutral'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle action={<Link href="/today" className="text-xs text-[var(--color-accent)]">Весь день →</Link>}>
              Три результата дня
            </CardTitle>
            {plan.outcomes.length > 0 ? (
              <ol className="space-y-2 text-sm">
                {plan.outcomes.map((outcome, index) => (
                  <li key={outcome} className="flex gap-3">
                    <span className="text-[var(--color-accent)]">{index + 1}</span>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Планировщик не нашёл задач на сегодня" hint="Добавь задачу через быстрый ввод." />
            )}
            <div className="mt-4">
              <ProgressBar value={plan.utilization} tone={load > 75 ? 'alert' : 'accent'} />
              <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                Занято {load}% свободного времени · план {plan.plannedTaskMinutes} мин из{' '}
                {plan.availableMinutes} мин
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>Расписание</CardTitle>
            {schedule.length > 0 ? (
              <div>
                {schedule.map((block) => (
                  <Row key={block.key}>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{block.title}</p>
                      <p className="text-xs text-[var(--color-ink-soft)]">{block.reason}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-[var(--color-ink-soft)]">
                      {localTimeLabel(block.start, user.timezone)}–{localTimeLabel(block.end, user.timezone)}
                    </span>
                  </Row>
                ))}
              </div>
            ) : (
              <EmptyState title="Сегодня пусто" />
            )}
          </Card>

          <QuickCapture />
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Ближайшее событие</CardTitle>
            {nextEvent ? (
              <div className="text-sm">
                <p>{nextEvent.title}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {formatRuDate(nextEvent.startsAt, user.timezone)},{' '}
                  {localTimeLabel(nextEvent.startsAt, user.timezone)}
                  {nextEvent.location ? ` · ${nextEvent.location}` : ''}
                </p>
                {nextEvent.travelMinutes > 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-clay)]">
                    Дорога: {nextEvent.travelMinutes} мин в каждую сторону
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Событий впереди нет" />
            )}
          </Card>

          <Card>
            <CardTitle>Дедлайны</CardTitle>
            {deadlines.length > 0 ? (
              <div>
                {deadlines.map((task) => (
                  <Row key={task.id}>
                    <span className="min-w-0 truncate text-sm">{task.title}</span>
                    <Badge tone={task.deadline && task.deadline < now ? 'alert' : 'clay'}>
                      {task.deadline ? localDateKey(task.deadline, user.timezone) : '—'}
                    </Badge>
                  </Row>
                ))}
              </div>
            ) : (
              <EmptyState title="Дедлайнов на неделе нет" />
            )}
          </Card>

          <Card>
            <CardTitle action={<Link href="/approvals" className="text-xs text-[var(--color-accent)]">Все →</Link>}>
              Риски
            </CardTitle>
            {findings.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {findings.slice(0, 5).map((finding) => (
                  <li key={`${finding.title}-${finding.detail}`}>
                    <Badge tone={finding.severity === 'critical' ? 'alert' : finding.severity === 'warning' ? 'clay' : 'neutral'}>
                      {finding.title}
                    </Badge>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{finding.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Проверка пройдена" hint="Конфликтов и перегрузки не найдено." />
            )}
          </Card>

          <Card>
            <CardTitle>Ждём ответа</CardTitle>
            <p className="text-sm">
              {snapshot.waitingOn > 0
                ? `${snapshot.waitingOn} задач(и) ждут другого человека`
                : 'Никого не ждём'}
            </p>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              Контент в работе: {snapshot.contentThisWeek} · неоплаченных счетов: {snapshot.unpaidInvoices}
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

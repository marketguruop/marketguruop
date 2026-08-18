import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildWeekPlan } from '@/lib/services/plan'
import { formatRuDateKey, weekStartKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const now = new Date()
  const start = params.start ?? weekStartKey(now, user.timezone)

  const [week, goals] = await Promise.all([
    buildWeekPlan(user.id, start, user.timezone, now),
    prisma.goal.findMany({
      where: { userId: user.id, deletedAt: null, status: 'active' },
      orderBy: { priority: 'asc' },
      take: 5,
    }),
  ])

  return (
    <>
      <PageHeader
        title="Неделя"
        subtitle={`Средняя загрузка ${Math.round(week.averageUtilization * 100)}% · запланировано ${formatDuration(
          week.totalPlannedMinutes,
        )}`}
      />

      {week.warnings.length > 0 ? (
        <Card className="mb-4 border-[var(--color-alert)]">
          <CardTitle>Предупреждения</CardTitle>
          <ul className="space-y-1 text-sm">
            {[...new Set(week.warnings)].slice(0, 6).map((warning) => (
              <li key={warning} className="text-[var(--color-ink-soft)]">
                • {warning}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {week.days.map((day) => {
            const taskBlocks = day.blocks.filter((b) => b.taskId)
            const meetings = day.blocks.filter((b) => b.kind === 'meeting')
            return (
              <Card key={day.dateKey} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/today?date=${day.dateKey}`} className="text-sm hover:text-[var(--color-accent)]">
                    {formatRuDateKey(day.dateKey)}
                  </Link>
                  <span className="text-xs text-[var(--color-ink-soft)]">
                    {taskBlocks.length} задач · {meetings.length} встреч · свободно{' '}
                    {formatDuration(day.freeMinutes)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={day.utilization} tone={day.utilization > 0.75 ? 'alert' : 'accent'} />
                </div>
                {day.outcomes.length > 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                    {day.outcomes.join(' · ')}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-ink-soft)]">Свободный день</p>
                )}
              </Card>
            )
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Цели недели</CardTitle>
            {goals.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{goal.title}</span>
                      <Badge tone={goal.priority === 'critical' ? 'alert' : 'accent'}>{goal.horizon}</Badge>
                    </div>
                    {goal.targetValue ? (
                      <div className="mt-2">
                        <ProgressBar value={goal.currentValue / goal.targetValue} tone="sage" />
                        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                          {Math.round(goal.currentValue)} из {Math.round(goal.targetValue)}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Цели не заданы" />
            )}
          </Card>

          <Card>
            <CardTitle>Не поместилось в неделю</CardTitle>
            {week.unscheduled.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {week.unscheduled.slice(0, 10).map((item) => (
                  <li key={item.taskId}>
                    <p className="truncate">{item.title}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{item.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Вся неделя помещается" />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

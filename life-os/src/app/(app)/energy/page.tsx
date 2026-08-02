import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkWorkoutConflict } from '@/lib/scheduling/planner'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Row, Stat } from '@/components/ui'
import { AgentConsole } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function EnergyPage() {
  const user = await requireUser()
  const since = new Date(Date.now() - 14 * 86_400_000)

  const [energyLogs, sleepLogs, workouts, habits] = await Promise.all([
    prisma.energyLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.sleepLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.workout.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.habit.findMany({
      where: { userId: user.id, deletedAt: null, status: 'active' },
      include: { logs: { where: { date: { gte: since } } } },
    }),
  ])

  const avgEnergy =
    energyLogs.length > 0 ? energyLogs.reduce((s, e) => s + e.level, 0) / energyLogs.length : 0
  const avgSleep =
    sleepLogs.length > 0 ? sleepLogs.reduce((s, l) => s + l.hours, 0) / sleepLogs.length : 0
  const shortSleep = sleepLogs.filter((l) => l.hours < 6.5)

  const todayWorkouts = workouts.filter(
    (w) => localDateKey(w.date, user.timezone) === localDateKey(new Date(), user.timezone),
  )
  const conflict = checkWorkoutConflict(todayWorkouts.map((w) => ({ kind: w.kind, intensity: w.intensity })))

  return (
    <>
      <PageHeader
        title="Энергия"
        subtitle="Личный журнал состояния. Это не медицинские данные и не диагноз."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Средняя энергия" value={avgEnergy.toFixed(1)} hint="за 14 дней, шкала 1–5" />
        <Stat label="Средний сон" value={`${avgSleep.toFixed(1)} ч`} />
        <Stat
          label="Ночей меньше 6.5 ч"
          value={shortSleep.length}
          tone={shortSleep.length > 3 ? 'alert' : 'neutral'}
        />
        <Stat label="Тренировок" value={workouts.length} />
      </div>

      {conflict ? (
        <Card className="mt-4 border-[var(--color-alert)]">
          <p className="text-sm text-[var(--color-alert)]">{conflict}</p>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Динамика</CardTitle>
          {energyLogs.length > 0 ? (
            <div className="space-y-2">
              {energyLogs.slice(0, 10).map((log) => {
                const sleep = sleepLogs.find(
                  (s) => localDateKey(s.date, user.timezone) === localDateKey(log.date, user.timezone),
                )
                return (
                  <div key={log.id}>
                    <div className="flex justify-between text-xs text-[var(--color-ink-soft)]">
                      <span>{localDateKey(log.date, user.timezone)}</span>
                      <span>
                        энергия {log.level}/5{sleep ? ` · сон ${sleep.hours} ч` : ''}
                      </span>
                    </div>
                    <ProgressBar value={log.level / 5} tone={log.level <= 2 ? 'alert' : 'sage'} />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title="Нет записей" hint="Отправь боту /energy 4" />
          )}
        </Card>

        <Card>
          <CardTitle>Тренировки и привычки</CardTitle>
          {workouts.length > 0 ? (
            <div>
              {workouts.slice(0, 8).map((workout) => (
                <Row key={workout.id}>
                  <span className="text-sm">
                    {workout.kind} · {workout.minutes} мин
                  </span>
                  <Badge tone={workout.intensity === 'high' ? 'alert' : 'sage'}>
                    {workout.intensity}
                  </Badge>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Тренировок нет" />
          )}

          {habits.length > 0 ? (
            <div className="mt-4 space-y-2">
              {habits.map((habit) => {
                const done = habit.logs.filter((l) => l.done).length
                return (
                  <div key={habit.id}>
                    <div className="flex justify-between text-xs">
                      <span>{habit.name}</span>
                      <span className="text-[var(--color-ink-soft)]">
                        {done} / {habit.targetPerWeek * 2} за 2 недели
                      </span>
                    </div>
                    <ProgressBar value={done / Math.max(1, habit.targetPerWeek * 2)} tone="accent" />
                  </div>
                )
              })}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-4">
        <AgentConsole agentKey="energy" name="Energy & Routine Agent" />
      </div>
    </>
  )
}

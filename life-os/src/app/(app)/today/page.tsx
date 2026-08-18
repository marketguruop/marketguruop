import { requireUser } from '@/lib/auth'
import { buildDayPlan } from '@/lib/services/plan'
import { reviewPlan } from '@/lib/ai/agents/review-agent'
import { minimalDayPlan } from '@/lib/scheduling/planner'
import { formatRuDate, localDateKey, localTimeLabel, minutesBetween } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { ApplyPlanButton, CompleteTaskButton } from '@/components/actions'
import { formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  focus: 'Фокус',
  admin: 'Рутина',
  buffer: 'Резерв',
  travel: 'Дорога',
  prep: 'Подготовка',
  meal: 'Еда',
  sport: 'Спорт',
  recovery: 'Восстановление',
  meeting: 'Встреча',
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const now = new Date()
  const dateKey = params.date ?? localDateKey(now, user.timezone)

  const plan = await buildDayPlan(user.id, dateKey, user.timezone, now)
  const findings = await reviewPlan(user.id, plan, now)
  const minimal = minimalDayPlan(plan)

  return (
    <>
      <PageHeader
        title={formatRuDate(new Date(`${dateKey}T12:00:00Z`), user.timezone)}
        subtitle={`${plan.blocks.filter((b) => b.taskId).length} задач · загрузка ${Math.round(
          plan.utilization * 100,
        )}% · свободно ${formatDuration(plan.freeMinutes)}`}
        action={<ApplyPlanButton date={dateKey} />}
      />

      <div className="mb-6">
        <ProgressBar value={plan.utilization} tone={plan.utilization > 0.75 ? 'alert' : 'accent'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardTitle>Timeline</CardTitle>
            {plan.blocks.length > 0 ? (
              <ol className="relative space-y-3 border-l border-[var(--color-line)] pl-5">
                {plan.blocks.map((block) => (
                  <li key={block.key} className="relative">
                    <span
                      className="absolute -left-[26px] top-2 h-2 w-2 rounded-full"
                      style={{
                        background:
                          block.kind === 'meeting'
                            ? 'var(--color-clay)'
                            : block.kind === 'buffer' || block.kind === 'recovery'
                              ? 'var(--color-sage)'
                              : 'var(--color-accent)',
                      }}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm">
                        {block.title}
                        {block.taskId === plan.mainTaskId ? (
                          <span className="ml-2 text-xs text-[var(--color-accent)]">главная</span>
                        ) : null}
                      </p>
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {localTimeLabel(block.start, user.timezone)}–
                        {localTimeLabel(block.end, user.timezone)} ·{' '}
                        {formatDuration(minutesBetween(block.start, block.end))}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={block.kind === 'meeting' ? 'clay' : block.kind === 'buffer' ? 'sage' : 'accent'}>
                        {KIND_LABEL[block.kind] ?? block.kind}
                      </Badge>
                      <span className="text-xs text-[var(--color-ink-soft)]">{block.reason}</span>
                      {block.taskId ? <CompleteTaskButton id={block.taskId} /> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="На этот день ничего не запланировано" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Минимальная версия дня</CardTitle>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              Если энергии мало — оставь только это.
            </p>
            {minimal.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {minimal.map((block) => (
                  <li key={block.key} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{block.title}</span>
                    <span className="whitespace-nowrap text-xs text-[var(--color-ink-soft)]">
                      {localTimeLabel(block.start, user.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Ничего обязательного" />
            )}
          </Card>

          <Card>
            <CardTitle>Не поместилось</CardTitle>
            {plan.deferred.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {plan.deferred.map((item) => (
                  <li key={item.taskId}>
                    <p>{item.title}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{item.reason}</p>
                    {item.needsReview ? (
                      <Badge tone="alert">Третий перенос — пересмотреть</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Всё поместилось" />
            )}
          </Card>

          <Card>
            <CardTitle>Проверка качества</CardTitle>
            {findings.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {findings.map((finding) => (
                  <li key={`${finding.title}-${finding.detail}`}>
                    <Badge tone={finding.severity === 'critical' ? 'alert' : 'clay'}>{finding.title}</Badge>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{finding.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="План реалистичный" />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums'
import { findDuplicateGroups, findStalledTasks } from '@/lib/services/tasks'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { CompleteTaskButton } from '@/components/actions'
import { QuickCapture } from '@/components/quick-capture'
import { formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  inbox: 'Входящие',
  clarification: 'Уточнить',
  planned: 'Запланировано',
  in_progress: 'В работе',
  waiting: 'Ждём',
  delegated: 'Делегировано',
  idea: 'Идея',
  completed: 'Готово',
  cancelled: 'Отменено',
}

const KANBAN_COLUMNS = ['inbox', 'planned', 'in_progress', 'waiting', 'delegated'] as const

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; project?: string; status?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(params.status ? { status: params.status } : { status: { in: OPEN_TASK_STATUSES } }),
      ...(params.project ? { projectId: params.project } : {}),
      ...(params.q ? { title: { contains: params.q } } : {}),
    },
    include: { project: { select: { name: true } } },
    orderBy: [{ deadline: 'asc' }, { priority: 'asc' }],
    take: 200,
  })

  const [stalled, duplicates] = await Promise.all([
    findStalledTasks(user.id),
    findDuplicateGroups(user.id),
  ])

  const byStatus = KANBAN_COLUMNS.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }))

  return (
    <>
      <PageHeader title="Задачи" subtitle={`${tasks.length} открытых`} />

      <form className="mb-4 flex flex-wrap gap-2" action="/tasks">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Поиск по названию"
          className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm"
        >
          <option value="">Все открытые</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white">
          Найти
        </button>
      </form>

      <div className="scroll-x -mx-4 mb-6 px-4">
        <div className="flex min-w-max gap-3">
          {byStatus.map((column) => (
            <div key={column.status} className="w-64 shrink-0">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                {STATUS_LABEL[column.status]} · {column.items.length}
              </p>
              <div className="space-y-2">
                {column.items.slice(0, 8).map((task) => (
                  <div key={task.id} className="card p-3">
                    <p className="text-sm">{task.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={task.priority === 'critical' ? 'alert' : 'neutral'}>{task.priority}</Badge>
                      <Badge tone="sage">{task.energy}</Badge>
                      {task.deadline ? (
                        <Badge tone="clay">{localDateKey(task.deadline, user.timezone)}</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
                {column.items.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-soft)]">Пусто</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card className="mb-4">
        <CardTitle>Таблица</CardTitle>
        <div className="scroll-x">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="pb-2 pr-3">Задача</th>
                <th className="pb-2 pr-3">Проект</th>
                <th className="pb-2 pr-3">Статус</th>
                <th className="pb-2 pr-3">Приоритет</th>
                <th className="pb-2 pr-3">Энергия</th>
                <th className="pb-2 pr-3">Оценка</th>
                <th className="pb-2 pr-3">Дедлайн</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-[var(--color-line)]">
                  <td className="py-2 pr-3">
                    <p>{task.title}</p>
                    {task.nextAction ? (
                      <p className="text-xs text-[var(--color-ink-soft)]">→ {task.nextAction}</p>
                    ) : null}
                    <div className="mt-1 flex gap-1.5">
                      {task.canDelegate ? <Badge tone="sage">делегируемо</Badge> : null}
                      {task.canAutomate ? <Badge tone="clay">автоматизируемо</Badge> : null}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-ink-soft)]">
                    {task.project?.name ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs">{STATUS_LABEL[task.status] ?? task.status}</td>
                  <td className="py-2 pr-3 text-xs">{task.priority}</td>
                  <td className="py-2 pr-3 text-xs">{task.energy}</td>
                  <td className="py-2 pr-3 text-xs">{formatDuration(task.estimatedMinutes)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {task.deadline ? localDateKey(task.deadline, user.timezone) : '—'}
                  </td>
                  <td className="py-2">
                    <CompleteTaskButton id={task.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 ? <EmptyState title="Задач нет" /> : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Зависшие</CardTitle>
          {stalled.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {stalled.map((task) => (
                <li key={task.id}>
                  <p>{task.title}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{task.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Зависших задач нет" />
          )}
        </Card>

        <Card>
          <CardTitle>Возможные дубли</CardTitle>
          {duplicates.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {duplicates.map((group) => (
                <li key={group.keepId}>
                  <p>{group.keepTitle}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    похожие: {group.duplicates.map((d) => d.title).join('; ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Дублей не найдено" />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <QuickCapture placeholder="Добавить задачу или несколько сразу" />
      </div>
    </>
  )
}

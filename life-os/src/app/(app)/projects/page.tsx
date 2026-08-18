import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/domain/enums'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { AgentConsole } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const user = await requireUser()
  const projects = await prisma.project.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        where: { deletedAt: null, status: { in: ['inbox', 'planned', 'in_progress', 'waiting'] } },
        orderBy: { deadline: 'asc' },
        take: 4,
      },
      goalRef: { select: { title: true } },
      contacts: { include: { contact: { select: { name: true } } } },
    },
    orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
  })

  return (
    <>
      <PageHeader title="Проекты" subtitle={`${projects.length} проектов в работе`} />

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const members = parseJsonArray<string>(project.members)
          return (
            <Card key={project.id}>
              <CardTitle
                action={
                  <Badge tone={project.priority === 'critical' ? 'alert' : 'accent'}>
                    {project.priority}
                  </Badge>
                }
              >
                {project.name}
              </CardTitle>

              {project.goal ? <p className="text-sm">{project.goal}</p> : null}
              {project.goalRef ? (
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  Цель: {project.goalRef.title}
                </p>
              ) : null}

              <div className="mt-3">
                <ProgressBar value={project.progress} tone="sage" />
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  Прогресс {Math.round(project.progress * 100)}% · задач {project._count.tasks}
                  {project.deadline ? ` · дедлайн ${localDateKey(project.deadline, user.timezone)}` : ''}
                </p>
              </div>

              {project.nextAction ? (
                <p className="mt-3 text-sm">
                  <span className="text-[var(--color-accent)]">Следующий шаг:</span> {project.nextAction}
                </p>
              ) : (
                <p className="mt-3 text-sm text-[var(--color-alert)]">Следующий шаг не задан</p>
              )}

              {project.risks ? (
                <p className="mt-2 text-xs text-[var(--color-alert)]">Риск: {project.risks}</p>
              ) : null}

              {project.tasks.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-[var(--color-ink-soft)]">
                  {project.tasks.map((task) => (
                    <li key={task.id}>• {task.title}</li>
                  ))}
                </ul>
              ) : null}

              {(members.length > 0 || project.contacts.length > 0) && (
                <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                  Участники: {[...members, ...project.contacts.map((c) => c.contact.name)].join(', ')}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {projects.length === 0 ? <EmptyState title="Проектов пока нет" /> : null}

      <div className="mt-6">
        <AgentConsole agentKey="business" name="Business & Marketing Agent" />
      </div>
    </>
  )
}

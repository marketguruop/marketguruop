import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AGENT_LIST } from '@/lib/ai/registry'
import { env, hasAnthropic } from '@/lib/env'
import { Badge, Card, CardTitle, EmptyState, PageHeader, Row, Stat } from '@/components/ui'
import { AgentConsole } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const user = await requireUser()
  const since = new Date(Date.now() - 30 * 86_400_000)

  const [runs, actions, failures, totals] = await Promise.all([
    prisma.agentRun.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 30,
    }),
    prisma.agentAction.findMany({
      where: { run: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.agentRun.count({ where: { userId: user.id, status: 'failed' } }),
    prisma.agentRun.aggregate({
      where: { userId: user.id, startedAt: { gte: since } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
  ])

  return (
    <>
      <PageHeader
        title="AI Command Center"
        subtitle={
          hasAnthropic()
            ? `Модель ${env().ANTHROPIC_MODEL}, effort ${env().ANTHROPIC_EFFORT}`
            : 'ANTHROPIC_API_KEY не задан — агенты работают в детерминированном режиме'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Запусков за 30 дней" value={totals._count} />
        <Stat label="Стоимость" value={`$${(totals._sum.costUsd ?? 0).toFixed(3)}`} />
        <Stat
          label="Токенов"
          value={`${(totals._sum.inputTokens ?? 0) + (totals._sum.outputTokens ?? 0)}`}
        />
        <Stat label="Ошибок" value={failures} tone={failures > 0 ? 'alert' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Агенты</CardTitle>
            <div>
              {AGENT_LIST.map((agent) => (
                <Row key={agent.key}>
                  <div className="min-w-0">
                    <p className="text-sm">{agent.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{agent.description}</p>
                  </div>
                  <Badge tone={agent.mode === 'core' ? 'accent' : 'neutral'}>
                    {agent.mode === 'core' ? 'пишет в базу' : 'только советует'}
                  </Badge>
                </Row>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>История запусков</CardTitle>
            {runs.length > 0 ? (
              <div className="scroll-x">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <tr>
                      <th className="pb-2 pr-3">Агент</th>
                      <th className="pb-2 pr-3">Вход</th>
                      <th className="pb-2 pr-3">Статус</th>
                      <th className="pb-2 pr-3">Шаги</th>
                      <th className="pb-2">Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-t border-[var(--color-line)]">
                        <td className="py-2 pr-3 text-xs">{run.agentKey}</td>
                        <td className="py-2 pr-3 text-xs">{run.input.slice(0, 60)}</td>
                        <td className="py-2 pr-3 text-xs">{run.status}</td>
                        <td className="py-2 pr-3 text-xs">{run.steps}</td>
                        <td className="py-2 text-xs">${run.costUsd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Агенты ещё не запускались" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <AgentConsole name="Chief of Staff и специалисты" />
          <Card>
            <CardTitle>Журнал действий</CardTitle>
            {actions.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {actions.map((action) => (
                  <li key={action.id}>
                    <span className="text-[var(--color-accent)]">{action.kind}</span>{' '}
                    <span className="text-[var(--color-ink-soft)]">
                      {action.entityType ?? ''} · {action.status}
                    </span>
                    {action.reason ? (
                      <p className="text-[var(--color-ink-soft)]">{action.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Действий не было" />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

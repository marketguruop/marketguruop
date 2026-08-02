import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/domain/enums'
import { RISK_LABEL, SAFE_ACTIONS, CONFIRM_ACTIONS, FORBIDDEN_ACTIONS } from '@/lib/approvals/policy'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { ApprovalActions } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const user = await requireUser()
  const [pending, decided] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { userId: user.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.approvalRequest.findMany({
      where: { userId: user.id, status: { not: 'pending' } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <>
      <PageHeader
        title="Approval Center"
        subtitle="Всё, что агенты не имеют права сделать без твоего слова"
      />

      <Card className="mb-4">
        <CardTitle>Ожидают решения</CardTitle>
        {pending.length > 0 ? (
          <ul className="space-y-4">
            {pending.map((request) => {
              const conflicts = parseJsonArray<string>(request.conflicts)
              return (
                <li key={request.id} id={request.id} className="rounded-xl bg-[var(--color-surface-2)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-[var(--color-ink-soft)]">{request.summary}</p>
                    </div>
                    <Badge tone={request.riskLevel === 'forbidden' ? 'alert' : 'clay'}>
                      {RISK_LABEL[request.riskLevel as 'safe' | 'confirm' | 'forbidden']}
                    </Badge>
                  </div>
                  {request.preview ? (
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--color-surface)] p-3 text-xs">
                      {request.preview}
                    </pre>
                  ) : null}
                  {conflicts.length > 0 ? (
                    <ul className="mt-2 text-xs text-[var(--color-alert)]">
                      {conflicts.map((conflict) => (
                        <li key={conflict}>⚠ {conflict}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <ApprovalActions id={request.id} />
                    <span className="text-xs text-[var(--color-ink-soft)]">
                      от {request.agentKey} · {request.actionKind}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="Нет запросов" hint="Агенты не пытаются сделать ничего, что требует подтверждения." />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>История решений</CardTitle>
          {decided.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {decided.map((request) => (
                <li key={request.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{request.title}</span>
                  <Badge tone={request.status === 'applied' ? 'sage' : 'neutral'}>{request.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Решений пока не было" />
          )}
        </Card>

        <Card>
          <CardTitle>Уровни доступа</CardTitle>
          <div className="space-y-3 text-xs">
            <div>
              <Badge tone="sage">Выполняется автоматически</Badge>
              <p className="mt-1 text-[var(--color-ink-soft)]">{SAFE_ACTIONS.join(', ')}</p>
            </div>
            <div>
              <Badge tone="clay">Нужно подтверждение</Badge>
              <p className="mt-1 text-[var(--color-ink-soft)]">{CONFIRM_ACTIONS.join(', ')}</p>
            </div>
            <div>
              <Badge tone="alert">Запрещено</Badge>
              <p className="mt-1 text-[var(--color-ink-soft)]">{FORBIDDEN_ACTIONS.join(', ')}</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

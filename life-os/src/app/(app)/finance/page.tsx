import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Row, Stat } from '@/components/ui'
import { AgentConsole } from '@/components/actions'
import { formatMoney } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const user = await requireUser()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [received, expected, expenses, invoices, goal] = await Promise.all([
    prisma.income.findMany({
      where: { userId: user.id, deletedAt: null, status: 'received', receivedAt: { gte: monthStart } },
    }),
    prisma.income.findMany({
      where: { userId: user.id, deletedAt: null, status: 'expected' },
      orderBy: { expectedAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { spentAt: 'desc' },
      take: 30,
    }),
    prisma.invoice.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.goal.findFirst({
      where: { userId: user.id, deletedAt: null, metric: 'income_eur_month' },
    }),
  ])

  const monthIncome = received.reduce((sum, i) => sum + i.amount, 0)
  const expectedTotal = expected.reduce((sum, i) => sum + i.amount, 0)
  const monthExpenses = expenses
    .filter((e) => !e.spentAt || e.spentAt >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0)
  const subscriptions = expenses.filter((e) => e.isSubscription)
  const unpaid = invoices.filter((i) => i.status === 'unpaid')
  const overdue = unpaid.filter((i) => i.dueAt && i.dueAt < now)
  const target = goal?.targetValue ?? 0
  const gap = target > 0 ? target - monthIncome - expectedTotal : 0

  return (
    <>
      <PageHeader title="Деньги" subtitle="Доход, ожидаемые платежи, счета и подписки" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Доход за месяц" value={formatMoney(monthIncome)} hint={target > 0 ? `Цель ${formatMoney(target)}` : undefined} />
        <Stat label="Ожидается" value={formatMoney(expectedTotal)} hint={`${expected.length} поступлений`} />
        <Stat label="Расходы за месяц" value={formatMoney(monthExpenses)} />
        <Stat
          label="Неоплаченные счета"
          value={unpaid.length}
          hint={overdue.length > 0 ? `${overdue.length} просрочено` : 'Без просрочек'}
          tone={overdue.length > 0 ? 'alert' : 'neutral'}
        />
      </div>

      {target > 0 ? (
        <Card className="mt-4">
          <CardTitle>Путь к цели месяца</CardTitle>
          <ProgressBar value={monthIncome / target} tone={monthIncome >= target ? 'sage' : 'accent'} />
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {gap > 0
              ? `До цели не хватает ${formatMoney(gap)} даже с учётом ожидаемых поступлений.`
              : 'Цель закрывается с учётом ожидаемых поступлений.'}
          </p>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Счета</CardTitle>
          {invoices.length > 0 ? (
            <div>
              {invoices.map((invoice) => (
                <Row key={invoice.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{invoice.counterparty}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {invoice.number ?? 'без номера'}
                      {invoice.dueAt ? ` · срок ${localDateKey(invoice.dueAt, user.timezone)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatMoney(invoice.amount, invoice.currency)}</p>
                    <Badge
                      tone={
                        invoice.status === 'paid'
                          ? 'sage'
                          : invoice.dueAt && invoice.dueAt < now
                            ? 'alert'
                            : 'clay'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Счетов нет" />
          )}
        </Card>

        <Card>
          <CardTitle>Подписки и расходы</CardTitle>
          {expenses.length > 0 ? (
            <div>
              {expenses.map((expense) => (
                <Row key={expense.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{expense.title}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {expense.category}
                      {expense.isSubscription ? ' · подписка' : ''}
                    </p>
                  </div>
                  <span className="text-sm">{formatMoney(expense.amount, expense.currency)}</span>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Расходов нет" />
          )}
          {subscriptions.length > 0 ? (
            <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
              Подписок: {subscriptions.length} на{' '}
              {formatMoney(subscriptions.reduce((sum, s) => sum + s.amount, 0))} в месяц.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="mt-4">
        <AgentConsole agentKey="finance" name="Finance Agent" />
      </div>
    </>
  )
}

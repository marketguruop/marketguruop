import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/domain/enums'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, Row } from '@/components/ui'
import { AgentConsole } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const user = await requireUser()
  const now = new Date()

  const [contacts, followUps] = await Promise.all([
    prisma.contact.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { projects: { include: { project: { select: { name: true } } } } },
      orderBy: { lastContactAt: 'asc' },
      take: 50,
    }),
    prisma.followUp.findMany({
      where: { userId: user.id, deletedAt: null, status: 'open' },
      include: { contact: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
    }),
  ])

  const overdue = followUps.filter((f) => f.dueAt && f.dueAt < now)

  return (
    <>
      <PageHeader
        title="Контакты"
        subtitle={`${contacts.length} человек · ${followUps.length} открытых follow-up${
          overdue.length > 0 ? ` · ${overdue.length} просрочено` : ''
        }`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Follow-up</CardTitle>
          {followUps.length > 0 ? (
            <div>
              {followUps.map((followUp) => (
                <Row key={followUp.id}>
                  <div className="min-w-0">
                    <p className="text-sm">
                      {followUp.contact.name} — {followUp.subject}
                    </p>
                    {followUp.agreement ? (
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        Договорённость: {followUp.agreement}
                      </p>
                    ) : null}
                    {followUp.draftMessage ? (
                      <p className="mt-1 rounded-lg bg-[var(--color-surface-2)] p-2 text-xs">
                        Черновик: {followUp.draftMessage}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={followUp.dueAt && followUp.dueAt < now ? 'alert' : 'clay'}>
                    {followUp.dueAt ? localDateKey(followUp.dueAt, user.timezone) : 'без срока'}
                  </Badge>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Все ответы отправлены" />
          )}
          <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
            Черновики не отправляются автоматически — только после подтверждения.
          </p>
        </Card>

        <Card>
          <CardTitle>База контактов</CardTitle>
          {contacts.length > 0 ? (
            <div>
              {contacts.map((contact) => (
                <Row key={contact.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{contact.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {[contact.role, contact.company, contact.telegram].filter(Boolean).join(' · ')}
                    </p>
                    {contact.projects.length > 0 ? (
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        Проекты: {contact.projects.map((p) => p.project.name).join(', ')}
                      </p>
                    ) : null}
                    <div className="mt-1 flex gap-1.5">
                      {parseJsonArray<string>(contact.tags).map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-[var(--color-ink-soft)]">
                    {contact.lastContactAt
                      ? localDateKey(contact.lastContactAt, user.timezone)
                      : 'нет контакта'}
                  </span>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Контактов нет" />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <AgentConsole agentKey="crm" name="Contacts & CRM Agent" />
      </div>
    </>
  )
}

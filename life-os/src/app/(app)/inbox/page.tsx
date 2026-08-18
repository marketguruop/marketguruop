import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/domain/enums'
import { Badge, Card, CardTitle, EmptyState, PageHeader, Row } from '@/components/ui'
import { QuickCapture } from '@/components/quick-capture'

export const dynamic = 'force-dynamic'

interface CreatedEntity {
  type: string
  id: string
  title: string
  note?: string
}

const STATUS_TONE = {
  pending: 'clay',
  processing: 'neutral',
  processed: 'sage',
  failed: 'alert',
  dismissed: 'neutral',
} as const

export default async function InboxPage() {
  const user = await requireUser()
  const items = await prisma.inboxItem.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <>
      <PageHeader
        title="Входящие"
        subtitle="Одно место для всего: текста, расшифровок, ссылок и идей"
      />

      <div className="mb-6">
        <QuickCapture />
      </div>

      <Card>
        <CardTitle>История разбора</CardTitle>
        {items.length > 0 ? (
          <div>
            {items.map((item) => {
              const created = parseJsonArray<CreatedEntity>(item.createdEntities)
              const tone = STATUS_TONE[item.status as keyof typeof STATUS_TONE] ?? 'neutral'
              return (
                <Row key={item.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{item.rawText}</p>
                    {item.summary ? (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{item.summary}</p>
                    ) : null}
                    {created.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {created.map((entity) => (
                          <li key={entity.id}>
                            <span className="text-[var(--color-accent)]">{entity.type}:</span>{' '}
                            {entity.title}
                            {entity.note ? (
                              <span className="text-[var(--color-ink-soft)]"> — {entity.note}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={tone}>{item.status}</Badge>
                    <span className="text-xs text-[var(--color-ink-soft)]">{item.channel}</span>
                    {item.needsClarification ? <Badge tone="clay">нужно уточнение</Badge> : null}
                  </div>
                </Row>
              )
            })}
          </div>
        ) : (
          <EmptyState title="Входящие пусты" hint="Напиши что-нибудь в поле выше или боту в Telegram." />
        )}
      </Card>
    </>
  )
}

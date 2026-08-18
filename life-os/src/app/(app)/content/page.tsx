import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/domain/enums'
import { localDateKey } from '@/lib/dates'
import { Badge, Card, CardTitle, EmptyState, PageHeader, Row } from '@/components/ui'
import { AgentConsole } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  const user = await requireUser()
  const [ideas, items, publications] = await Promise.all([
    prisma.contentIdea.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.contentItem.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ publishAt: 'asc' }],
      take: 30,
    }),
    prisma.publication.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 15,
    }),
  ])

  const totalViews = publications.reduce((sum, p) => sum + p.views, 0)

  return (
    <>
      <PageHeader
        title="Контент"
        subtitle={`${ideas.length} идей · ${items.length} материалов · ${totalViews} просмотров`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Идеи</CardTitle>
          {ideas.length > 0 ? (
            <div>
              {ideas.map((idea) => (
                <Row key={idea.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{idea.title}</p>
                    {idea.hook ? (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Хук: {idea.hook}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {parseJsonArray<string>(idea.platforms).map((platform) => (
                        <Badge key={platform} tone="neutral">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge tone={idea.priority === 'high' ? 'accent' : 'neutral'}>{idea.status}</Badge>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Идей пока нет" hint="Скинь мысль в быстрый ввод — она попадёт сюда." />
          )}
        </Card>

        <Card>
          <CardTitle>Контент-календарь</CardTitle>
          {items.length > 0 ? (
            <div>
              {items.map((item) => (
                <Row key={item.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                      {item.platform} · {item.format}
                      {item.shootAt ? ` · съёмка ${localDateKey(item.shootAt, user.timezone)}` : ''}
                      {item.publishAt ? ` · публикация ${localDateKey(item.publishAt, user.timezone)}` : ''}
                    </p>
                    {item.script ? (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{item.script}</p>
                    ) : null}
                    {parseJsonArray<string>(item.shotList).length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                        Кадры: {parseJsonArray<string>(item.shotList).join(' → ')}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone="clay">{item.status}</Badge>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Материалов нет" />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Аналитика публикаций</CardTitle>
          {publications.length > 0 ? (
            <div className="scroll-x">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  <tr>
                    <th className="pb-2 pr-3">Площадка</th>
                    <th className="pb-2 pr-3">Просмотры</th>
                    <th className="pb-2 pr-3">Лайки</th>
                    <th className="pb-2">Сохранения</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.map((publication) => (
                    <tr key={publication.id} className="border-t border-[var(--color-line)]">
                      <td className="py-2 pr-3 text-xs">{publication.platform}</td>
                      <td className="py-2 pr-3 text-xs">{publication.views}</td>
                      <td className="py-2 pr-3 text-xs">{publication.likes}</td>
                      <td className="py-2 text-xs">{publication.saves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Публикаций ещё нет" />
          )}
        </Card>

        <AgentConsole agentKey="content" name="Content Director" />
      </div>
    </>
  )
}

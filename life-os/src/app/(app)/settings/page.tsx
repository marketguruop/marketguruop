import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { env, hasAnthropic, hasGoogleCalendar, hasTelegram } from '@/lib/env'
import { listMemory } from '@/lib/ai/memory'
import { Badge, Card, CardTitle, EmptyState, PageHeader, Row } from '@/components/ui'
import { SyncCalendarButton } from '@/components/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const [integrations, memory, automations] = await Promise.all([
    prisma.integration.findMany({ where: { userId: user.id, deletedAt: null } }),
    listMemory(user.id),
    prisma.automation.findMany({ where: { userId: user.id, deletedAt: null } }),
  ])

  const configured = [
    { name: 'Anthropic API', ready: hasAnthropic(), hint: 'ANTHROPIC_API_KEY' },
    { name: 'Telegram Bot', ready: hasTelegram(), hint: 'TELEGRAM_BOT_TOKEN' },
    { name: 'Google Calendar', ready: hasGoogleCalendar(), hint: 'GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI' },
  ]

  return (
    <>
      <PageHeader title="Настройки" subtitle={`${user.email} · ${user.timezone}`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Интеграции</CardTitle>
          <div>
            {configured.map((item) => (
              <Row key={item.name}>
                <div>
                  <p className="text-sm">{item.name}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{item.hint}</p>
                </div>
                <Badge tone={item.ready ? 'sage' : 'neutral'}>
                  {item.ready ? 'настроено' : 'не настроено'}
                </Badge>
              </Row>
            ))}
            {integrations.map((integration) => (
              <Row key={integration.id}>
                <div>
                  <p className="text-sm">{integration.displayName ?? integration.provider}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {integration.lastSyncAt
                      ? `Синхронизация: ${integration.lastSyncAt.toISOString().slice(0, 16).replace('T', ' ')}`
                      : 'Синхронизаций не было'}
                    {integration.lastError ? ` · ошибка: ${integration.lastError}` : ''}
                  </p>
                </div>
                <Badge tone={integration.status === 'connected' ? 'sage' : 'alert'}>
                  {integration.status}
                </Badge>
              </Row>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <SyncCalendarButton />
            {hasGoogleCalendar() ? (
              <a
                href="/api/integrations/google/start"
                className="inline-block rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
              >
                Подключить Google Calendar
              </a>
            ) : (
              <p className="text-xs text-[var(--color-ink-soft)]">
                Чтобы подключить Google Calendar, заполни переменные окружения и перезапусти приложение.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Память</CardTitle>
          {memory.length > 0 ? (
            <div>
              {memory.map((entry) => (
                <Row key={entry.id}>
                  <div className="min-w-0">
                    <p className="text-sm">{entry.key}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{entry.value}</p>
                  </div>
                  <Badge tone={entry.category === 'rule' ? 'clay' : 'neutral'}>{entry.category}</Badge>
                </Row>
              ))}
            </div>
          ) : (
            <EmptyState title="Память пуста" />
          )}
          <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
            Удалить запись: <code>DELETE /api/memory/&lt;id&gt;</code>. Очистить слой:{' '}
            <code>DELETE /api/memory?layer=long</code>.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Автоматизации</CardTitle>
        {automations.length > 0 ? (
          <div>
            {automations.map((automation) => (
              <Row key={automation.id}>
                <div className="min-w-0">
                  <p className="text-sm">{automation.name}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{automation.description}</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                    Триггер: {automation.trigger} · экономия ~{automation.savedMinutesPerWeek} мин/нед ·
                    риск: {automation.riskLevel}
                  </p>
                </div>
                <Badge tone={automation.enabled ? 'sage' : 'neutral'}>
                  {automation.enabled ? 'включена' : automation.status}
                </Badge>
              </Row>
            ))}
          </div>
        ) : (
          <EmptyState title="Автоматизаций нет" />
        )}
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Автоматизация включается только после подтверждения в Approval Center.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle>Лимиты агентов</CardTitle>
        <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
          <li>Модель: {env().ANTHROPIC_MODEL} (effort {env().ANTHROPIC_EFFORT})</li>
          <li>Максимум шагов на запуск: {env().AI_MAX_STEPS}</li>
          <li>Максимальная стоимость запуска: ${env().AI_MAX_COST_USD_PER_RUN}</li>
          <li>Максимум запусков в час: {env().AI_MAX_RUNS_PER_HOUR}</li>
        </ul>
      </Card>
    </>
  )
}

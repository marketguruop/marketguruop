'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

async function post(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return (await response.json()) as { ok: boolean; error?: string }
}

export function ApprovalActions({ id }: { id: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function decide(decision: 'approve' | 'reject'): Promise<void> {
    const result = await post(`/api/approvals/${id}`, { decision })
    setMessage(result.ok ? 'Готово.' : (result.error ?? 'Не удалось выполнить.'))
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void decide('approve')}
        disabled={pending}
        className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs text-white disabled:opacity-40"
      >
        Подтвердить
      </button>
      <button
        onClick={() => void decide('reject')}
        disabled={pending}
        className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs disabled:opacity-40"
      >
        Отклонить
      </button>
      {message ? <span className="text-xs text-[var(--color-ink-soft)]">{message}</span> : null}
    </div>
  )
}

export function CompleteTaskButton({ id, label = 'Готово' }: { id: string; label?: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function complete(): Promise<void> {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={() => void complete()}
      disabled={pending}
      className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-ink-soft)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40"
    >
      {label}
    </button>
  )
}

export function ApplyPlanButton({ date }: { date: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function apply(): Promise<void> {
    const result = await post('/api/plan', { date })
    setMessage(result.ok ? 'План записан в тайм-блоки.' : (result.error ?? 'Ошибка.'))
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => void apply()}
        disabled={pending}
        className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white disabled:opacity-40"
      >
        {pending ? 'Открываю…' : 'Открыть мой день'}
      </button>
      {message ? <span className="text-xs text-[var(--color-ink-soft)]">{message}</span> : null}
    </div>
  )
}

export function SyncCalendarButton() {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function sync(): Promise<void> {
    const response = await fetch('/api/calendar/sync', { method: 'POST' })
    const body = (await response.json()) as {
      ok: boolean
      error?: string
      data?: { reason: string; imported: number; updated: number }
    }
    setMessage(
      body.ok && body.data
        ? `${body.data.reason} Импортировано: ${body.data.imported}, обновлено: ${body.data.updated}.`
        : (body.data?.reason ?? body.error ?? 'Синхронизация недоступна.'),
    )
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => void sync()}
        disabled={pending}
        className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-40"
      >
        {pending ? 'Синхронизирую…' : 'Синхронизировать Google Calendar'}
      </button>
      {message ? <span className="text-xs text-[var(--color-ink-soft)]">{message}</span> : null}
    </div>
  )
}

interface AgentRunData {
  summary?: string
  usedAi: boolean
  findings?: { title: string; detail: string; severity: 'info' | 'warning' | 'critical' }[]
  created?: { type: string; id: string; title: string; note?: string }[]
  skipped?: { title: string; reason: string }[]
  text?: string
}

const SEVERITY_COLOR: Record<string, string> = {
  info: 'text-[var(--color-ink-soft)]',
  warning: 'text-[var(--color-clay)]',
  critical: 'text-[var(--color-alert)]',
}

export function AgentConsole({
  agentKey,
  name,
  placeholder,
}: {
  agentKey?: string
  name: string
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AgentRunData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function run(): Promise<void> {
    if (!input.trim()) return
    setPending(true)
    setError(null)
    setResult(null)
    const response = await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, ...(agentKey ? { agentKey } : {}) }),
    })
    const body = (await response.json()) as {
      ok: boolean
      error?: string
      data?: AgentRunData & { data?: AgentRunData }
    }
    setPending(false)
    if (!body.ok || !body.data) {
      setError(body.error ?? 'Не удалось запустить агента.')
      return
    }
    // The routed shape nests the payload; the direct shape does not.
    setResult(body.data.data ?? body.data)
    // The agent writes rows, so the page behind the console is now stale.
    startTransition(() => router.refresh())
  }

  const created = result?.created ?? []
  const findings = result?.findings ?? []
  const skipped = result?.skipped ?? []

  return (
    <div className="card p-5">
      <p className="text-sm text-[var(--color-ink-soft)]">Запустить: {name}</p>
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={2}
        className="mt-2 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
        placeholder={placeholder ?? 'Например: что здесь требует внимания?'}
      />
      <button
        onClick={() => void run()}
        disabled={pending || !input.trim()}
        className="mt-3 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white disabled:opacity-40"
      >
        {pending ? 'Работаю…' : 'Запустить'}
      </button>

      {error ? <p className="mt-3 text-sm text-[var(--color-alert)]">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-xl bg-[var(--color-surface-2)] p-4 text-sm">
          <p className="font-medium">{result.summary ?? result.text}</p>
          {!result.usedAi ? (
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
              Без AI: разбор по правилам системы, ключ Anthropic не настроен.
            </p>
          ) : null}

          {findings.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {findings.map((finding) => (
                <li key={finding.title} className={SEVERITY_COLOR[finding.severity] ?? ''}>
                  <span className="font-medium">{finding.title}:</span> {finding.detail}
                </li>
              ))}
            </ul>
          ) : null}

          {created.length > 0 ? (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Создано
              </p>
              <ul className="mt-1 space-y-1">
                {created.map((entity) => (
                  <li key={entity.id}>
                    <span className="text-[var(--color-accent)]">{entity.type}:</span> {entity.title}
                    {entity.note ? (
                      <span className="text-[var(--color-ink-soft)]"> — {entity.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {skipped.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-ink-soft)]">
              {skipped.map((item) => (
                <li key={item.title}>
                  пропущено: {item.title} ({item.reason})
                </li>
              ))}
            </ul>
          ) : null}

          {created.length === 0 && findings.length === 0 && skipped.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              Агент не нашёл, что создать — по этим данным всё в порядке.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

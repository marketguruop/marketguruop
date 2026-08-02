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

export function AgentConsole({ agentKey, name }: { agentKey?: string; name: string }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(): Promise<void> {
    if (!input.trim()) return
    setPending(true)
    setOutput(null)
    const response = await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, ...(agentKey ? { agentKey } : {}) }),
    })
    const body = (await response.json()) as {
      ok: boolean
      error?: string
      data?: { text: string; agentName?: string; usedAi: boolean }
    }
    setOutput(body.ok && body.data ? body.data.text : (body.error ?? 'Ошибка запуска агента.'))
    setPending(false)
  }

  return (
    <div className="card p-5">
      <p className="text-sm text-[var(--color-ink-soft)]">Спросить: {name}</p>
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={2}
        className="mt-2 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
        placeholder="Например: что мне сегодня важнее всего?"
      />
      <button
        onClick={() => void run()}
        disabled={pending || !input.trim()}
        className="mt-3 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white disabled:opacity-40"
      >
        {pending ? 'Работаю…' : 'Запустить'}
      </button>
      {output ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--color-surface-2)] p-4 text-sm">
          {output}
        </pre>
      ) : null}
    </div>
  )
}

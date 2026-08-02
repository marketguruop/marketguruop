'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface CapturedEntity {
  type: string
  id: string
  title: string
  note?: string
}

interface CaptureResponse {
  ok: boolean
  error?: string
  data?: {
    summary: string
    created: CapturedEntity[]
    skipped: { title: string; reason: string }[]
    needsClarification: string[]
    usedAi: boolean
  }
}

export function QuickCapture({ placeholder }: { placeholder?: string }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<CaptureResponse['data'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function submit(): Promise<void> {
    if (!text.trim()) return
    setError(null)
    const response = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, channel: 'web' }),
    })
    const body = (await response.json()) as CaptureResponse
    if (!body.ok || !body.data) {
      setError(body.error ?? 'Не удалось разобрать запись.')
      return
    }
    setResult(body.data)
    setText('')
    startTransition(() => router.refresh())
  }

  return (
    <div className="card p-5">
      <label htmlFor="capture" className="text-sm text-[var(--color-ink-soft)]">
        Быстрый ввод — текст, расшифровка голосового, обрывок мысли
      </label>
      <textarea
        id="capture"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit()
        }}
        rows={3}
        placeholder={placeholder ?? 'Завтра написать Саше, договориться о съёмке и придумать три Reels'}
        className="mt-2 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--color-ink-soft)]">⌘/Ctrl + Enter — разобрать</span>
        <button
          onClick={() => void submit()}
          disabled={pending || text.trim().length === 0}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white disabled:opacity-40"
        >
          {pending ? 'Разбираю…' : 'Разобрать'}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--color-alert)]">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-xl bg-[var(--color-surface-2)] p-4 text-sm">
          <p className="font-medium">{result.summary}</p>
          {!result.usedAi ? (
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
              Разобрано локальным парсером — AI-ключ не настроен.
            </p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {result.created.map((entity) => (
              <li key={entity.id}>
                <span className="text-[var(--color-accent)]">{entity.type}:</span> {entity.title}
                {entity.note ? (
                  <span className="text-[var(--color-ink-soft)]"> — {entity.note}</span>
                ) : null}
              </li>
            ))}
            {result.skipped.map((skip) => (
              <li key={skip.title} className="text-[var(--color-ink-soft)]">
                пропущено: {skip.title} ({skip.reason})
              </li>
            ))}
            {result.needsClarification.map((question) => (
              <li key={question} className="text-[var(--color-clay)]">
                ? {question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

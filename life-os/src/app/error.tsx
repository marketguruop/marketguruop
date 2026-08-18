'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('render error', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-md p-7 text-center">
        <h1 className="text-2xl">Что-то сломалось</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Ошибка записана в лог сервера. Данные не потеряны.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">Код: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="mt-5 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white"
        >
          Попробовать снова
        </button>
      </div>
    </main>
  )
}

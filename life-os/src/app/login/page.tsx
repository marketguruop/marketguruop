'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await response.json()) as { ok: boolean; error?: string }
    setPending(false)
    if (!body.ok) {
      setError(body.error ?? 'Не удалось войти.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <p className="font-display text-2xl leading-tight">EMILIYA</p>
        <p className="font-display text-2xl leading-tight text-[var(--color-accent)]">LIFE OS</p>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Личная система: задачи, календарь, контент, деньги и агенты.
        </p>

        <label className="mt-6 block text-sm" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          required
        />

        <label className="mt-4 block text-sm" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          required
        />

        {error ? <p className="mt-3 text-sm text-[var(--color-alert)]">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-full bg-[var(--color-accent)] py-2.5 text-sm text-white disabled:opacity-40"
        >
          {pending ? 'Вхожу…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}

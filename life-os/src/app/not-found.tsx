import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-md p-7 text-center">
        <h1 className="text-2xl">Страница не найдена</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--color-accent)]">
          Вернуться на дашборд
        </Link>
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  short: string
  primary: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Дашборд', short: 'Дом', primary: true },
  { href: '/today', label: 'Сегодня', short: 'День', primary: true },
  { href: '/week', label: 'Неделя', short: 'Неделя', primary: true },
  { href: '/tasks', label: 'Задачи', short: 'Задачи', primary: true },
  { href: '/inbox', label: 'Входящие', short: 'Инбокс', primary: true },
  { href: '/projects', label: 'Проекты', short: 'Проекты', primary: false },
  { href: '/content', label: 'Контент', short: 'Контент', primary: false },
  { href: '/finance', label: 'Деньги', short: 'Деньги', primary: false },
  { href: '/crm', label: 'Контакты', short: 'CRM', primary: false },
  { href: '/energy', label: 'Энергия', short: 'Энергия', primary: false },
  { href: '/approvals', label: 'Подтверждения', short: 'Approve', primary: false },
  { href: '/agents', label: 'AI Command Center', short: 'Агенты', primary: false },
  { href: '/settings', label: 'Настройки', short: 'Настройки', primary: false },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function Sidebar({ userName, pendingApprovals }: { userName: string; pendingApprovals: number }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] p-5 lg:flex">
      <div className="mb-8">
        <p className="font-display text-lg leading-tight">EMILIYA</p>
        <p className="font-display text-lg leading-tight text-[var(--color-accent)]">LIFE OS</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              isActive(pathname, item.href)
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]',
            )}
          >
            <span>{item.label}</span>
            {item.href === '/approvals' && pendingApprovals > 0 ? (
              <span className="rounded-full bg-[var(--color-accent)] px-2 text-xs text-white">
                {pendingApprovals}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="mt-6 border-t border-[var(--color-line)] pt-4 text-sm">
        <p className="text-[var(--color-ink-soft)]">{userName}</p>
        <button onClick={logout} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
          Выйти
        </button>
      </div>
    </aside>
  )
}

export function BottomNav({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((i) => i.primary)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--color-line)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]',
            isActive(pathname, item.href) ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-soft)]',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isActive(pathname, item.href) ? 'bg-[var(--color-accent)]' : 'bg-transparent',
            )}
          />
          {item.short}
          {item.href === '/inbox' && pendingApprovals > 0 ? ' •' : ''}
        </Link>
      ))}
    </nav>
  )
}

export function MobileMenu() {
  const pathname = usePathname()
  const secondary = NAV_ITEMS.filter((i) => !i.primary)
  return (
    <div className="scroll-x -mx-4 mb-4 flex gap-2 px-4 lg:hidden">
      {secondary.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'whitespace-nowrap rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs',
            isActive(pathname, item.href)
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
              : 'text-[var(--color-ink-soft)]',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}

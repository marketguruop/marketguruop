import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={cn('card p-5', className)}>{children}</Tag>
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-medium">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}

type Tone = 'neutral' | 'accent' | 'sage' | 'clay' | 'alert'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  sage: 'bg-[color-mix(in_srgb,var(--color-sage)_18%,transparent)] text-[var(--color-sage)]',
  clay: 'bg-[color-mix(in_srgb,var(--color-clay)_18%,transparent)] text-[var(--color-clay)]',
  alert: 'bg-[color-mix(in_srgb,var(--color-alert)_14%,transparent)] text-[var(--color-alert)]',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', TONE_CLASS[tone])}>
      {children}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: Tone
}) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-2xl',
          tone === 'alert' && 'text-[var(--color-alert)]',
          tone === 'accent' && 'text-[var(--color-accent)]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{hint}</p> : null}
    </div>
  )
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const color =
    tone === 'alert'
      ? 'var(--color-alert)'
      : tone === 'sage'
        ? 'var(--color-sage)'
        : 'var(--color-accent)'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] p-6 text-center">
      <p className="text-sm">{title}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{hint}</p> : null}
    </div>
  )
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-[var(--color-line)] py-3 last:border-b-0', className)}>
      {children}
    </div>
  )
}

import * as React from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/stat-card.tsx — A single aggregate metric tile.
//
// PRESENTATIONAL ONLY. It renders a count + label that the caller has already
// computed from an AGGREGATE query (no raw confidential rows ever reach here).
// `tone` only changes the accent colour; it carries no data.
// =============================================================================

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const toneAccent: Record<StatTone, string> = {
  neutral: 'text-ink',
  brand: 'text-brand-700',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

export interface StatCardProps {
  label: string
  value: number | string
  /** Small descriptive line under the value. */
  hint?: string
  tone?: StatTone
  /** Optional internal href turning the whole tile into a link. */
  href?: string
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        'flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-card)]',
        href &&
          'transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
    >
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      <span className={cn('text-3xl font-semibold tabular-nums', toneAccent[tone])}>
        {value}
      </span>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {body}
      </Link>
    )
  }
  return body
}

/** Responsive grid wrapper for StatCards. */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  )
}

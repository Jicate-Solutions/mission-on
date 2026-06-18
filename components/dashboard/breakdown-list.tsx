import * as React from 'react'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/breakdown-list.tsx — A simple "label -> count" list, used
// for aggregate breakdowns (pipeline stage tallies, module-code distribution,
// status counts). PRESENTATIONAL ONLY — the caller passes already-aggregated
// numbers, never raw rows.
// =============================================================================

export interface BreakdownRow {
  label: string
  count: number
  badgeVariant?: BadgeProps['variant']
}

export function BreakdownList({
  rows,
  emptyText = 'Nothing to show yet.',
}: {
  rows: BreakdownRow[]
  emptyText?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyText}</p>
  }

  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink">
              {row.badgeVariant ? (
                <Badge variant={row.badgeVariant}>{row.label}</Badge>
              ) : (
                row.label
              )}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {row.count}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={cn('h-full rounded-full bg-brand-400')}
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

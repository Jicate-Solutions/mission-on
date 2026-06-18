'use client'

import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/components/dashboard/notification-types'

// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/notification-list.tsx — Presentational list of
// notifications. CLIENT but stateless: it renders items and calls back when one
// is activated (to mark read). Holds no Supabase session; all data arrives via
// props from the server page or the bell.
// =============================================================================

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export interface NotificationListProps {
  items: NotificationItem[]
  /** Called when a user activates an unread item; receives the id. */
  onActivate?: (id: string) => void
  emptyText?: string
  className?: string
}

export function NotificationList({
  items,
  onActivate,
  emptyText = 'You have no notifications.',
  className,
}: NotificationListProps) {
  if (items.length === 0) {
    return (
      <p className={cn('px-1 py-6 text-center text-sm text-ink-muted', className)}>
        {emptyText}
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-col divide-y divide-border', className)}>
      {items.map((n) => {
        const unread = n.status === 'unread'
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => unread && onActivate?.(n.id)}
              className={cn(
                'flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors',
                'hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                unread ? 'bg-brand-50' : 'bg-transparent',
                !unread && 'cursor-default'
              )}
              aria-label={unread ? `Mark "${n.title}" as read` : n.title}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'text-sm',
                    unread ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
                  )}
                >
                  {n.title}
                </span>
                {unread ? (
                  <span
                    aria-hidden
                    className="mt-1 size-2 shrink-0 rounded-full bg-brand-500"
                  />
                ) : null}
              </div>
              {n.body ? (
                <span className="text-xs text-ink-muted">{n.body}</span>
              ) : null}
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{n.type}</Badge>
                <span className="text-[11px] text-ink-muted">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

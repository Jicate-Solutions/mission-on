'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { NotificationList } from '@/components/dashboard/notification-list'
import type {
  NotificationFeedData,
  NotificationItem,
} from '@/components/dashboard/notification-types'

// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/notification-bell.tsx — Bell button + dropdown panel.
//
// CLIENT component. It NEVER touches Supabase directly — it talks only to the
// server-mediated Route Handlers under /api/notifications, which re-verify the
// session and scope every read/write to the caller's own rows. The browser
// holds no session and no confidential data: notification titles/bodies are
// role-appropriate summaries by contract.
//
// Accepts an optional server-rendered initial feed so the badge count is correct
// on first paint without a flash, then refreshes on open.
// =============================================================================

async function fetchFeed(): Promise<NotificationFeedData> {
  const res = await fetch('/api/notifications?limit=20', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to load notifications.')
  return (await res.json()) as NotificationFeedData
}

export interface NotificationBellProps {
  initialFeed?: NotificationFeedData
  className?: string
}

export function NotificationBell({
  initialFeed,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<NotificationItem[]>(
    initialFeed?.notifications ?? []
  )
  const [unread, setUnread] = React.useState(initialFeed?.unreadCount ?? 0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const feed = await fetchFeed()
      setItems(feed.notifications)
      setUnread(feed.unreadCount)
    } catch {
      setError('Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Open the panel and refresh from the server (event-driven, not in an effect).
  const openPanel = React.useCallback(() => {
    setOpen(true)
    void load()
  }, [load])

  const togglePanel = React.useCallback(() => {
    if (open) {
      setOpen(false)
    } else {
      openPanel()
    }
  }, [open, openPanel])

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = React.useCallback(async (id: string) => {
    // Optimistic.
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
    )
    setUnread((c) => Math.max(0, c - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        cache: 'no-store',
      })
    } catch {
      // Re-sync on failure.
      void load()
    }
  }, [load])

  const markAll = React.useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, status: 'read' })))
    setUnread(0)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        cache: 'no-store',
      })
    } catch {
      void load()
    }
  }, [load])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={togglePanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
        className="relative inline-flex size-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-brand-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-ink-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <p className="px-3 py-6 text-center text-sm text-danger">
                {error}
              </p>
            ) : loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">
                Loading…
              </p>
            ) : (
              <NotificationList items={items} onActivate={markRead} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

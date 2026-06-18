// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/notification-types.ts — Plain shared types for the
// notification UI. No 'use client' / 'server-only' so both server (initial feed
// prop) and client (bell/panel) can import it safely.
// =============================================================================

import type { NotificationStatus } from '@/types/database'

/** Client-facing notification shape (mirrors the API DTO, camelCase). */
export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  status: NotificationStatus
  createdAt: string
}

export interface NotificationFeedData {
  notifications: NotificationItem[]
  unreadCount: number
}

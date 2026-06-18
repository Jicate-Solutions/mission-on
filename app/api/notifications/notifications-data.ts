import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/api/notifications/notifications-data.ts — Server-only data access for the
// per-user notification feed.
//
// SECURITY (read before editing):
//   Every function re-verifies the session internally (defense against a direct
//   call / direct POST to the route handler). All reads/writes go through the
//   RLS-scoped SSR client, so a user can only ever see or mutate their OWN
//   notifications:
//     - notif_select       : user_id = auth.uid() (or admin) — we ALWAYS pin to
//                            the caller's own user_id regardless, so the admin
//                            broaden does not leak another user's feed here.
//     - notif_self_update  : a user may flip status on their own rows only.
//   Notifications carry NO confidential payload by contract — title/body are
//   role-appropriate summaries written by the generating feature, never raw
//   minor data or classification codes. This module only reads/marks them.
//
// This file is local to the notifications API namespace and follows the same
// auth-re-verify + DTO boundary pattern as the canonical DAL.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireSession, requireRole } from '@/lib/dal'
import type {
  NotificationInsert,
  NotificationRow,
  NotificationStatus,
} from '@/types/database'

/** Allow-listed DTO returned to the client. */
export interface NotificationDTO {
  id: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  status: NotificationStatus
  createdAt: string
}

function toDTO(
  row: Pick<
    NotificationRow,
    | 'id'
    | 'type'
    | 'title'
    | 'body'
    | 'entity_type'
    | 'entity_id'
    | 'status'
    | 'created_at'
  >
): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    createdAt: row.created_at,
  }
}

export interface NotificationFeed {
  notifications: NotificationDTO[]
  unreadCount: number
}

/**
 * The calling user's most recent notifications (own rows only) plus an unread
 * count. `limit` is clamped to a sane range. ALWAYS pinned to the caller's
 * user_id even though admins could read more — a feed is personal.
 */
export async function getOwnNotifications(
  limit = 20
): Promise<NotificationFeed> {
  const session = await requireSession()
  const take = Math.min(Math.max(limit, 1), 50)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, entity_type, entity_id, status, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(take)

  if (error) throw error

  const notifications = (data ?? []).map(toDTO)
  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  return { notifications, unreadCount }
}

// -----------------------------------------------------------------------------
// WRITE side — emit notifications when program events occur (stage changes,
// mentor-change requests, new bugs, safeguarding flags, questionnaire
// completion). Feature modules call createNotification(s) from their own
// admin-context Server Actions / Route Handlers.
//
// RLS (notif_admin_insert) only permits INSERT when is_admin_role(); this helper
// re-verifies admin/super_admin internally to fail fast with a clear 403 rather
// than a silent RLS rejection. Titles/bodies MUST be role-appropriate summaries
// — never raw minor identity or classification codes.
// -----------------------------------------------------------------------------

export interface CreateNotificationInput {
  /** Recipient auth user id. */
  userId: string
  /** Machine type, e.g. 'stage_change' | 'mentor_change' | 'bug' | 'safeguarding' | 'questionnaire'. */
  type: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
}

/**
 * Insert a single notification for one user. ADMIN/SUPER_ADMIN context only
 * (matches RLS notif_admin_insert). Returns the new notification id, or null if
 * nothing was inserted.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<string | null> {
  await requireRole(['admin', 'super_admin'])
  if (!input.userId || !input.title || !input.type) return null

  const supabase = await createClient()
  const payload: NotificationInsert = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return (data?.id as string | undefined) ?? null
}

/**
 * Fan-out: insert the same notification for many recipients (e.g. notify all
 * admins of a new safeguarding escalation). ADMIN/SUPER_ADMIN context only.
 * Returns the count inserted.
 */
export async function createNotifications(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<number> {
  await requireRole(['admin', 'super_admin'])
  const recipients = Array.from(new Set(userIds.filter(Boolean)))
  if (recipients.length === 0 || !input.title || !input.type) return 0

  const supabase = await createClient()
  const rows: NotificationInsert[] = recipients.map((uid) => ({
    user_id: uid,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  }))

  const { data, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}

/** Just the caller's unread count — cheap query for the bell badge. */
export async function getOwnUnreadCount(): Promise<number> {
  const session = await requireSession()

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('status', 'unread')

  if (error) throw error
  return count ?? 0
}

/**
 * Mark ONE notification read. Scoped to the caller's own row by user_id; RLS
 * (notif_self_update) is the backstop. Returns true if a row was updated.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  const session = await requireSession()
  if (!id || typeof id !== 'string') return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read' })
    .eq('id', id)
    .eq('user_id', session.userId)
    .eq('status', 'unread')
    .select('id')

  if (error) throw error
  return (data?.length ?? 0) > 0
}

/** Mark ALL the caller's unread notifications read. Returns how many changed. */
export async function markAllNotificationsRead(): Promise<number> {
  const session = await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read' })
    .eq('user_id', session.userId)
    .eq('status', 'unread')
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}

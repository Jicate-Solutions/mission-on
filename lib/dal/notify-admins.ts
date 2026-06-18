import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/notify-admins.ts — fan-out an in-app notification to the triage owners
// (admin + super_admin) for events fired by a NON-admin actor (PRD §7.11).
//
// Why service-role: the notifications INSERT policy (notif_admin_insert) requires
// is_admin_role(). A coordinator changing a stage, or a learner raising a mentor-
// change request, is NOT an admin, so the alert must be written with elevated
// context. This generalizes the per-feature _routing.ts helpers (bug, safeguarding)
// into one place. Payloads are role-appropriate summaries only — never raw minor
// identity or classification codes.
//
// Best-effort: a notification failure must NEVER roll back the primary action —
// we log and return.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'

/** Resolve the admin + super_admin recipient user ids. */
export async function resolveAdminRecipients(): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['admin', 'super_admin'])
  if (error) throw error
  return [
    ...new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  ]
}

export interface NotifyAdminsInput {
  /** Machine type, e.g. 'stage_change' | 'mentor_change' | 'questionnaire' | 'bug'. */
  type: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
}

/**
 * Insert one notification per admin/super_admin. Pass excludeUserId to avoid
 * notifying the actor when the actor is themselves an admin (e.g. an admin who
 * changes a stage need not alert themselves).
 */
export async function notifyAdmins(
  input: NotifyAdminsInput,
  opts: { excludeUserId?: string } = {}
): Promise<void> {
  let recipients: string[]
  try {
    recipients = await resolveAdminRecipients()
  } catch (err) {
    console.error('[notify-admins] recipient lookup failed:', err)
    return
  }
  if (opts.excludeUserId) {
    recipients = recipients.filter((id) => id !== opts.excludeUserId)
  }
  if (recipients.length === 0) return

  const admin = createAdminClient()
  const rows = recipients.map((uid) => ({
    user_id: uid,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    status: 'unread' as const,
  }))
  const { error } = await admin.from('notifications').insert(rows)
  if (error) console.error('[notify-admins] insert failed:', error.message)
}

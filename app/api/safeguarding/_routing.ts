import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// safeguarding routing helpers (server-only, service-role).
//
// Determines the designated safeguarding lead and the full set of recipients to
// notify when a follow-through case is escalated, and writes the notification
// rows. Uses the SERVICE-ROLE client deliberately and ONLY for:
//   - reading user_roles to find leads/admins (no learner/mentor identity), and
//   - inserting notifications (RLS would otherwise require is_admin_role()).
// It never reads minor identity and never returns one. Audit is written by the
// caller via the DAL writeAudit() path.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve the recipients for a safeguarding escalation.
 *
 * Designated lead preference (PRD §12 "designated safeguarding lead"):
 *   1) a user whose user_roles.sub_role = 'jkkn_counsellor' (the named
 *      counsellor), else
 *   2) a super_admin, else
 *   3) an admin.
 * Returns the chosen lead's user id (for safeguarding_escalations.escalated_to)
 * plus the full recipient set (lead + all admins/super_admins + all counsellors)
 * who should receive an in-app notification.
 */
export async function resolveSafeguardingRecipients(): Promise<{
  leadUserId: string | null
  recipientUserIds: string[]
}> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('user_roles')
    .select('user_id, role, sub_role')

  if (error) throw error

  const rows = (data ?? []) as Array<{
    user_id: string
    role: string
    sub_role: string | null
  }>

  const counsellors = rows
    .filter((r) => r.sub_role === 'jkkn_counsellor')
    .map((r) => r.user_id)
  const superAdmins = rows
    .filter((r) => r.role === 'super_admin')
    .map((r) => r.user_id)
  const admins = rows
    .filter((r) => r.role === 'admin')
    .map((r) => r.user_id)

  const leadUserId =
    counsellors[0] ?? superAdmins[0] ?? admins[0] ?? null

  const recipientUserIds = [
    ...new Set([...counsellors, ...superAdmins, ...admins]),
  ]

  return { leadUserId, recipientUserIds }
}

/**
 * Insert a notification for each recipient. Uses the service-role client because
 * the notifications INSERT policy requires is_admin_role(); a mentor escalating
 * is not an admin, so the routed alert must be written with elevated context.
 * No minor identity is included in the payload — only the escalation id.
 */
export async function notifyRecipients(input: {
  recipientUserIds: string[]
  escalationId: string
  title: string
  body: string
}): Promise<void> {
  if (input.recipientUserIds.length === 0) return

  const admin = createAdminClient()
  const rows = input.recipientUserIds.map((userId) => ({
    user_id: userId,
    type: 'safeguarding_escalation',
    title: input.title,
    body: input.body,
    entity_type: 'safeguarding_escalations',
    entity_id: input.escalationId,
    status: 'unread' as const,
  }))

  const { error } = await admin.from('notifications').insert(rows)
  if (error) {
    // A notification failure must not roll back the escalation itself.
    console.error('[safeguarding] notify failed:', error.message)
  }
}

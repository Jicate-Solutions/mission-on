import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/audit/_data.ts — read the append-only audit log
// (PRD §13: audit log for classification access, role changes, safeguarding
// escalations, identity provisioning/reveal, moderation).
//
// SECURITY: SUPER_ADMIN ONLY. The audit_logs RLS (audit_super_admin_select) only
// permits is_super_admin() to read, and this function re-verifies the role before
// any query (defense against direct invocation). Actor emails are resolved via
// the service-role client (auth.users is not exposed to the SSR client) AFTER the
// super_admin check — never before.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/dal'

export interface AuditLogDTO {
  id: string
  action: string
  actorId: string | null
  /** Resolved actor email, or null if the actor row/email is gone. */
  actorEmail: string | null
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

interface AuditLogRow {
  id: string
  action: string
  actor_id: string | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

/**
 * Most-recent audit entries (newest first). Super_admin only. `limit` is clamped.
 */
export async function listAuditLog(limit = 100): Promise<AuditLogDTO[]> {
  await requireRole(['super_admin'])
  const take = Math.min(Math.max(limit, 1), 500)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, actor_id, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(take)

  if (error) throw error
  const rows = (data ?? []) as AuditLogRow[]

  // Resolve distinct actor ids -> emails via the service-role client (only after
  // the super_admin gate above). getUserById per distinct actor avoids walking
  // the whole user list.
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
  ]
  const emailById = new Map<string, string | null>()
  if (actorIds.length > 0) {
    const admin = createAdminClient()
    await Promise.all(
      actorIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id)
        emailById.set(id, u?.user?.email ?? null)
      })
    )
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorId: r.actor_id,
    actorEmail: r.actor_id ? emailById.get(r.actor_id) ?? null : null,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  }))
}

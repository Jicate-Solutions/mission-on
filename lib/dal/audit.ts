import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/audit.ts — Append-only audit trail writes.
//
// audit_logs has NO insert policy; the ONLY write path is the write_audit_log()
// SECURITY DEFINER RPC, granted to service_role only. So we MUST go through the
// service-role (admin) client here. Clients can never forge audit entries.
//
// We log classification access, role changes, and safeguarding events (PRD §13:
// "audit log for classification access, role changes, and safeguarding
// escalations"). The actor is resolved from the verified session — never from
// caller-supplied input — so an audit row cannot be attributed to someone else.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/dal/session'

/**
 * Stable audit action categories. The `action` column is free text in the DB,
 * but the DAL constrains it to this allow-list so every audit entry is
 * greppable and consistent. Extend deliberately — do not invent ad-hoc strings.
 */
export type AuditAction =
  // Classification visibility (admin/super_admin read a module code).
  | 'classification.read'
  | 'classification.confirm'
  // Role / RBAC changes.
  | 'role.assign'
  | 'role.change'
  | 'role.revoke'
  // Identity provisioning (creating a mentor/learner profile + alias).
  | 'mentor.provision'
  | 'learner.provision'
  // Designating / clearing the JKKN safeguarding counsellor (sub_role).
  | 'counsellor.designate'
  // Access-code lifecycle (doc/update.md §3-4). Never logs the plaintext code
  // or its hash — only the affected user/role.
  | 'access_code.generate'
  | 'access_code.revoke'
  | 'access_code.regenerate'
  // Program-config changes (e.g. safeguarding contacts, SLA thresholds).
  | 'config.update'
  // Safeguarding lifecycle.
  | 'safeguarding.escalate'
  | 'safeguarding.acknowledge'
  | 'safeguarding.resolve'
  // Identity reveal (a mentor read a learner's real identity under reveal-gate).
  | 'identity.reveal'
  // Moderation.
  | 'anonymous_post.hide'

export interface WriteAuditInput {
  action: AuditAction
  /** Entity table/type the action concerns (e.g. 'questionnaire_responses'). */
  entityType?: string | null
  /** Entity row id the action concerns. */
  entityId?: string | null
  /** Free-form structured context. Do NOT put raw minor PII here. */
  metadata?: Record<string, unknown>
  /**
   * Override the actor. Defaults to the verified session user. Pass only for
   * system-initiated entries with no interactive actor (rare).
   */
  actorId?: string | null
}

/**
 * Write one audit entry via the service-role RPC. Resolves the actor from the
 * verified session unless explicitly overridden. Returns the new audit row id,
 * or null on failure (audit must never break the primary operation — failures
 * are surfaced via console.error and a null return, not a throw).
 */
export async function writeAudit(
  input: WriteAuditInput
): Promise<string | null> {
  // Resolve the actor from the trusted session, not from caller input.
  let actorId = input.actorId ?? null
  if (actorId === null) {
    const session = await verifySession()
    actorId = session?.userId ?? null
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('write_audit_log', {
    p_actor_id: actorId,
    p_action: input.action,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_metadata: (input.metadata ?? {}) as Record<string, unknown>,
  })

  if (error) {
    // Never let audit failure crash the caller; log for ops follow-up.
    console.error('[audit] write_audit_log failed:', error.message)
    return null
  }

  return (data as string | null) ?? null
}

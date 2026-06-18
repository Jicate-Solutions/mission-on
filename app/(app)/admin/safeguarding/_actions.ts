'use server'

// =============================================================================
// Mission ON — Smart Choices
// safeguarding queue (admin / super_admin) — Server Actions.
//
// SECURITY: each action re-verifies requireRole(['admin','super_admin']) — a
// direct POST is not protected by the page gate. State changes go through the
// RLS-scoped client (safeguard_update permits admins + the escalated-to user).
// Every transition writes an audit entry (PRD §13). Resolving a case ENDS the
// reveal: once status='resolved' the log re-hides and can_access_learner_identity
// returns false, so the mentor loses identity access automatically.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, writeAudit, AuthorizationError } from '@/lib/dal'

export interface QueueActionState {
  ok: boolean
  error: string | null
}

const MAX_NOTES = 4000

function fail(error: string): QueueActionState {
  return { ok: false, error }
}

function revalidateQueues() {
  revalidatePath('/admin/safeguarding')
  revalidatePath('/super-admin/safeguarding')
}

/**
 * Acknowledge an OPEN escalation. Sets status='acknowledged' + acknowledged_at.
 * Keeps the case (and the reveal) active. Audited.
 */
export async function acknowledgeEscalation(
  _prev: QueueActionState,
  formData: FormData
): Promise<QueueActionState> {
  let session
  try {
    session = await requireRole(['admin', 'super_admin'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const escalationId = String(formData.get('escalationId') ?? '').trim()
  if (!escalationId) return fail('Missing escalation.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safeguarding_escalations')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', escalationId)
    .eq('status', 'open') // only an open case can be acknowledged
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) return fail('Could not acknowledge. Please try again.')
  if (!data) return fail('This case is no longer open.')

  await writeAudit({
    action: 'safeguarding.acknowledge',
    entityType: 'safeguarding_escalations',
    entityId: escalationId,
    actorId: session.userId,
    metadata: { role: session.role },
  })

  revalidateQueues()
  return { ok: true, error: null }
}

/**
 * Resolve an escalation. Sets status='resolved' + resolved_at and records the
 * resolution audit_notes. Resolving ENDS reveal-on-safeguarding (the log re-
 * hides; mentor identity access is revoked). Audited.
 */
export async function resolveEscalation(
  _prev: QueueActionState,
  formData: FormData
): Promise<QueueActionState> {
  let session
  try {
    session = await requireRole(['admin', 'super_admin'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const escalationId = String(formData.get('escalationId') ?? '').trim()
  const notes = String(formData.get('auditNotes') ?? '').trim()
  if (!escalationId) return fail('Missing escalation.')
  if (!notes) return fail('Add a brief resolution note for the record.')
  if (notes.length > MAX_NOTES) return fail('Resolution note is too long.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safeguarding_escalations')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      audit_notes: notes,
    })
    .eq('id', escalationId)
    .in('status', ['open', 'acknowledged']) // cannot re-resolve
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) return fail('Could not resolve. Please try again.')
  if (!data) return fail('This case is already resolved.')

  await writeAudit({
    action: 'safeguarding.resolve',
    entityType: 'safeguarding_escalations',
    entityId: escalationId,
    actorId: session.userId,
    metadata: { role: session.role },
  })

  revalidateQueues()
  return { ok: true, error: null }
}

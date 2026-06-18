'use server'

// =============================================================================
// Mission ON — Smart Choices
// follow-through (mentor) — Server Actions.
//
// SECURITY: a Server Action is reachable by a DIRECT POST, so EVERY action here
// re-verifies session + role (requireRole(['mentor'])) before doing anything. A
// page-level gate does NOT protect these.
//
// Writes go through the RLS-scoped SSR client (mentor context) so the database
// enforces "authoring mentor only". Escalation additionally routes to the
// safeguarding lead and writes an audit entry.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, writeAudit, AuthorizationError } from '@/lib/dal'
import { getOwnMentorProfileId, getAssignedLearners } from './_data'
import {
  resolveSafeguardingRecipients,
  notifyRecipients,
} from '@/app/api/safeguarding/_routing'

export interface ActionState {
  ok: boolean
  error: string | null
  /** Set on a successful create so the client can reset the form. */
  createdLogId?: string
}

const MAX_NOTES = 5000
const MAX_REASON = 2000

function fail(error: string): ActionState {
  return { ok: false, error }
}

/**
 * Create a follow-through log against an assigned learner. The learner is
 * supplied as a learner_public.id (alias id, the only learner reference the
 * mentor UI holds); we resolve it to learner_profiles.id ONLY for a learner
 * actively assigned to this mentor, then write the log.
 */
export async function createLog(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let session
  try {
    session = await requireRole(['mentor'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const learnerPublicId = String(formData.get('learnerPublicId') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const flagSafeguarding =
    String(formData.get('flagSafeguarding') ?? '') === 'on'
  const reason = String(formData.get('reason') ?? '').trim()

  if (!learnerPublicId) return fail('Select a learner.')
  if (!notes) return fail('Add a note for this follow-through.')
  if (notes.length > MAX_NOTES) return fail('Note is too long.')
  if (flagSafeguarding && !reason) {
    return fail('A safeguarding flag needs a brief reason.')
  }
  if (reason.length > MAX_REASON) return fail('Reason is too long.')

  const mentorProfileId = await getOwnMentorProfileId()
  if (!mentorProfileId) return fail('No mentor profile found for your account.')

  // Resolve the alias id -> profile id, but ONLY for an actively-assigned
  // learner. This prevents logging against a learner not assigned to you.
  const assigned = await getAssignedLearners()
  const match = assigned.find((a) => a.learnerPublicId === learnerPublicId)
  if (!match) return fail('That learner is not assigned to you.')

  const supabase = await createClient()
  const { data: inserted, error: insertError } = await supabase
    .from('follow_through_logs')
    .insert({
      learner_id: match.learnerProfileId,
      mentor_id: mentorProfileId,
      notes,
      flags: flagSafeguarding ? ['safeguarding'] : [],
      // safeguarding_escalated is flipped by the escalation step below, never
      // by this insert alone — the escalation row is the source of truth.
    })
    .select('id')
    .single<{ id: string }>()

  if (insertError) return fail('Could not save the log. Please try again.')

  if (flagSafeguarding) {
    const escResult = await escalateLogInternal({
      logId: inserted.id,
      reason,
      escalatedBy: session.userId,
    })
    if (!escResult.ok) return escResult
  }

  revalidatePath('/mentor/follow-through')
  return { ok: true, error: null, createdLogId: inserted.id }
}

/**
 * Escalate an EXISTING own log to the safeguarding workflow. Idempotency: if an
 * active escalation already exists, we do not create a duplicate.
 */
export async function escalateExistingLog(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let session
  try {
    session = await requireRole(['mentor'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const logId = String(formData.get('logId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!logId) return fail('Missing log.')
  if (!reason) return fail('A safeguarding escalation needs a brief reason.')
  if (reason.length > MAX_REASON) return fail('Reason is too long.')

  const result = await escalateLogInternal({
    logId,
    reason,
    escalatedBy: session.userId,
  })
  if (!result.ok) return result

  revalidatePath('/mentor/follow-through')
  return { ok: true, error: null }
}

/**
 * Shared escalation core. Verifies the log is the caller's, flips the log's
 * safeguarding_escalated flag, inserts the escalation row routed to the
 * designated lead, notifies recipients, and writes an audit entry.
 *
 * Returns ActionState so callers can surface failures inline.
 */
async function escalateLogInternal(input: {
  logId: string
  reason: string
  escalatedBy: string
}): Promise<ActionState> {
  const supabase = await createClient()

  // Confirm the log belongs to this mentor and read its current state. RLS
  // already scopes ftl_mentor_select to own logs, so a foreign log returns null.
  const { data: log, error: logError } = await supabase
    .from('follow_through_logs')
    .select('id, safeguarding_escalated')
    .eq('id', input.logId)
    .maybeSingle<{ id: string; safeguarding_escalated: boolean }>()

  if (logError) return fail('Could not read the log.')
  if (!log) return fail('Log not found or not yours.')

  // Idempotency: do not stack active escalations on the same log.
  const { data: existing, error: existingError } = await supabase
    .from('safeguarding_escalations')
    .select('id, status')
    .eq('follow_through_log_id', input.logId)
    .in('status', ['open', 'acknowledged'])
    .maybeSingle<{ id: string; status: string }>()

  if (existingError) return fail('Could not check existing escalations.')
  if (existing) {
    // Already active — nothing to do, treat as success.
    return { ok: true, error: null }
  }

  // Resolve the designated lead + recipient set (service-role read).
  const { leadUserId, recipientUserIds } =
    await resolveSafeguardingRecipients()

  // Insert the escalation under the mentor's RLS context (safeguard_mentor_insert
  // requires escalated_by = auth.uid() and that the log is theirs).
  const { data: esc, error: escError } = await supabase
    .from('safeguarding_escalations')
    .insert({
      follow_through_log_id: input.logId,
      escalated_by: input.escalatedBy,
      escalated_to: leadUserId,
      reason: input.reason,
      status: 'open',
    })
    .select('id')
    .single<{ id: string }>()

  if (escError) return fail('Could not raise the escalation.')

  // Flip the log flag so admins can read it (ftl_admin_select needs it true).
  const { error: flagError } = await supabase
    .from('follow_through_logs')
    .update({ safeguarding_escalated: true })
    .eq('id', input.logId)

  if (flagError) {
    // The escalation row exists; the reveal gate (can_access_learner_identity)
    // depends on BOTH the flag and an active escalation, so surface this.
    return fail('Escalation raised but flag update failed. Contact an admin.')
  }

  // Route in-app notifications to the lead + admins/super_admins + counsellors.
  await notifyRecipients({
    recipientUserIds,
    escalationId: esc.id,
    title: 'New safeguarding escalation',
    body: 'A mentor flagged a follow-through case for safeguarding review.',
  })

  // Audit the safeguarding event (PRD §13). No minor PII in metadata.
  await writeAudit({
    action: 'safeguarding.escalate',
    entityType: 'safeguarding_escalations',
    entityId: esc.id,
    actorId: input.escalatedBy,
    metadata: { followThroughLogId: input.logId, routedTo: leadUserId },
  })

  return { ok: true, error: null }
}

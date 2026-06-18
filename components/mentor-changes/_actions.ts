'use server'

// =============================================================================
// Mission ON — Smart Choices
// mentor-change request queue (admin / super_admin) — Server Actions.
//
// SECURITY: each action re-verifies requireRole(['admin','super_admin']) — a
// direct POST is NOT protected by the page gate. Mutations run under the admin's
// RLS context (mcr_admin_update / lma_admin_write require is_admin_role()); the
// explicit requireRole is the primary app-layer gate.
//
// PRD §7.6 / §9.2: a learner raises a "change my Mentor" request; the Admin
// reviews and either REJECTS it, or APPROVES it and "opens the switch" by
// reassigning the learner's active mentor to a NEW mentor the admin picks by
// ALIAS. On approve we:
//   1. flip the request to status='approved' (+ resolver + timestamp),
//   2. reassign the learner's ACTIVE learner_mentor_assignments row to the new
//      mentor_public_id (or insert one if none is active).
// Everything here is alias-only — no learner/mentor real identity is read.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, AuthorizationError } from '@/lib/dal'

export interface MentorChangeActionState {
  ok: boolean
  error: string | null
}

const MAX_NOTE = 4000

function fail(error: string): MentorChangeActionState {
  return { ok: false, error }
}

function revalidateQueues() {
  revalidatePath('/admin/mentor-changes')
  revalidatePath('/super-admin/mentor-changes')
}

/**
 * Approve a mentor-change request and OPEN THE SWITCH: reassign the learner's
 * active assignment to the newly chosen mentor (by mentor_public.id / alias).
 *
 * Flow:
 *   - mark the request approved (only if still 'open'),
 *   - reassign the learner's ACTIVE learner_mentor_assignments row to the new
 *     mentor; if no active row exists, create one (status 'active').
 * The new mentor must differ from the current mentor.
 */
export async function approveChangeRequest(
  _prev: MentorChangeActionState,
  formData: FormData
): Promise<MentorChangeActionState> {
  let session
  try {
    session = await requireRole(['admin', 'super_admin'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const requestId = String(formData.get('requestId') ?? '').trim()
  const learnerPublicId = String(formData.get('learnerPublicId') ?? '').trim()
  const newMentorPublicId = String(
    formData.get('newMentorPublicId') ?? ''
  ).trim()
  if (!requestId || !learnerPublicId) return fail('Missing request details.')
  if (!newMentorPublicId) return fail('Choose a mentor to switch to.')

  const supabase = await createClient()

  // 1) Flip the request to approved — only if still open (no double-resolve).
  const { data: updated, error: reqError } = await supabase
    .from('mentor_change_requests')
    .update({
      status: 'approved',
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle<{ id: string }>()

  if (reqError) return fail('Could not approve the request. Please try again.')
  if (!updated) return fail('This request has already been resolved.')

  // 2) Open the switch: reassign the learner's ACTIVE assignment to the new
  //    mentor. Guard against a no-op switch to the same mentor.
  const { data: active, error: activeError } = await supabase
    .from('learner_mentor_assignments')
    .select('id, mentor_public_id')
    .eq('learner_public_id', learnerPublicId)
    .eq('status', 'active')
    .maybeSingle<{ id: string; mentor_public_id: string }>()

  if (activeError) {
    return fail('Request approved, but the switch could not be opened.')
  }

  if (active && active.mentor_public_id === newMentorPublicId) {
    return fail('That is already the learner’s mentor — pick a different one.')
  }

  if (active) {
    const { error: switchError } = await supabase
      .from('learner_mentor_assignments')
      .update({
        mentor_public_id: newMentorPublicId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', active.id)
    if (switchError) {
      return fail('Request approved, but the reassignment failed. Retry.')
    }
  } else {
    // No active assignment on record — create one for the new mentor.
    const { error: insertError } = await supabase
      .from('learner_mentor_assignments')
      .insert({
        learner_public_id: learnerPublicId,
        mentor_public_id: newMentorPublicId,
        status: 'active',
      })
    if (insertError) {
      return fail('Request approved, but the new assignment failed. Retry.')
    }
  }

  revalidateQueues()
  return { ok: true, error: null }
}

/**
 * Reject a mentor-change request. Marks it rejected (+ resolver + timestamp)
 * WITHOUT touching the learner's assignment. Only an OPEN request can be
 * rejected. An optional note is accepted but not persisted as identity data.
 */
export async function rejectChangeRequest(
  _prev: MentorChangeActionState,
  formData: FormData
): Promise<MentorChangeActionState> {
  let session
  try {
    session = await requireRole(['admin', 'super_admin'])
  } catch (e) {
    if (e instanceof AuthorizationError) return fail('Not authorized.')
    throw e
  }

  const requestId = String(formData.get('requestId') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  if (!requestId) return fail('Missing request.')
  if (note.length > MAX_NOTE) return fail('Note is too long.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_change_requests')
    .update({
      status: 'rejected',
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) return fail('Could not reject the request. Please try again.')
  if (!data) return fail('This request has already been resolved.')

  revalidateQueues()
  return { ok: true, error: null }
}

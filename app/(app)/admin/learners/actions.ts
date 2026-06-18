'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/learners/actions.ts — Admin Server Actions for mentor-change
// review (PRD §9.5): approve (optionally reassigning a new mentor), or reject.
//
// SECURITY: re-verifies role ['admin','super_admin'] on EVERY invocation
// (direct-POST defense). RLS backstops every write (mcr_admin_update,
// lma_admin_write). resolved_by is taken from the trusted session, never from
// client input. ALIAS-ONLY throughout — no real-identity table is touched.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, getMentorPublic } from '@/lib/dal'
import { getChangeRequests } from '@/app/(app)/admin/learners/_data/directory'

export interface AdminActionState {
  error: string | null
  success: string | null
}

export const initialAdminActionState: AdminActionState = {
  error: null,
  success: null,
}

/**
 * Approve a mentor-change request. Marks the request 'approved'; if a new mentor
 * alias is supplied, ends any live assignment for that learner and creates a new
 * 'active' assignment to the chosen mentor. If no new mentor is supplied, the
 * learner is left mentor-pending (admin/learner can pick later).
 */
export async function approveChangeRequest(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireRole(['admin', 'super_admin'])

  const requestId = String(formData.get('requestId') ?? '').trim()
  const newMentorPublicId = String(
    formData.get('newMentorPublicId') ?? ''
  ).trim()
  if (!requestId) {
    return { error: 'Missing request reference.', success: null }
  }

  // Load the (open) request to get the learner alias id.
  const open = await getChangeRequests({ onlyOpen: true })
  const request = open.find((r) => r.id === requestId)
  if (!request) {
    return { error: 'That request is no longer open.', success: null }
  }

  const supabase = await createClient()

  // (a) If a new mentor was chosen, validate it (alias + active) and reassign.
  if (newMentorPublicId) {
    const mentor = await getMentorPublic(newMentorPublicId)
    if (!mentor || !mentor.is_active) {
      return { error: 'That mentor is not available.', success: null }
    }

    // End the learner's live assignments first (single live mentor invariant).
    const { error: endErr } = await supabase
      .from('learner_mentor_assignments')
      .update({ status: 'reassigned' })
      .eq('learner_public_id', request.learnerPublicId)
      .in('status', ['active', 'pending_change'])
    if (endErr) {
      return { error: 'Could not update the current assignment.', success: null }
    }

    const { error: newErr } = await supabase
      .from('learner_mentor_assignments')
      .insert({
        learner_public_id: request.learnerPublicId,
        mentor_public_id: newMentorPublicId,
        status: 'active',
      })
    if (newErr) {
      return { error: 'Could not assign the new mentor.', success: null }
    }
  }

  // (b) Resolve the request.
  const { error: reqErr } = await supabase
    .from('mentor_change_requests')
    .update({
      status: 'approved',
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  if (reqErr) {
    return { error: 'Could not update the request.', success: null }
  }

  revalidatePath('/admin/learners')
  return {
    error: null,
    success: newMentorPublicId
      ? 'Approved and reassigned.'
      : 'Approved. The learner can choose a new mentor.',
  }
}

/** Reject a mentor-change request (keeps the current assignment in place). */
export async function rejectChangeRequest(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireRole(['admin', 'super_admin'])

  const requestId = String(formData.get('requestId') ?? '').trim()
  if (!requestId) {
    return { error: 'Missing request reference.', success: null }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_change_requests')
    .update({
      status: 'rejected',
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'open')
  if (error) {
    return { error: 'Could not update the request.', success: null }
  }

  revalidatePath('/admin/learners')
  return { error: null, success: 'Request rejected.' }
}

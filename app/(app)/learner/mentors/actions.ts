'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/mentors/actions.ts — Learner Server Actions for the
// learner-selection feature: choose a mentor, and raise a mentor-change request.
//
// SECURITY: a Server Action is reachable by a DIRECT POST — the page gate does
// NOT protect it. Every action below re-verifies role ('learner') internally and
// resolves the learner's OWN learner_public id from the trusted session (never
// from client input). RLS (lma_learner_insert / mcr_learner_insert) is the
// backstop: a learner may only insert rows tied to their own alias row.
//
// We never accept a learner_public_id from the client and never touch
// real-identity tables. Mentor targets are validated as active alias rows via
// the DAL (getMentorPublic) before writing.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, getMentorPublic } from '@/lib/dal'
import { notifyAdmins } from '@/lib/dal/notify-admins'
import {
  getOwnLearnerPublicId,
  getOwnChosenMentor,
  hasOpenChangeRequest,
} from '@/app/(app)/learner/_data/selection'

export interface ActionState {
  error: string | null
  success: string | null
}

export const initialActionState: ActionState = { error: null, success: null }

/**
 * Choose / confirm a mentor (learner picks BY ALIAS). Writes an 'active'
 * learner_mentor_assignments row for the calling learner. If the learner already
 * has a live assignment, this is treated as a switch only when no open
 * mentor-change request is pending (admin-mediated switches go through the
 * change-request flow, not here) — selecting the SAME mentor is a no-op.
 *
 * Shaped for useActionState. Re-verifies role internally.
 */
export async function chooseMentor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // (1) Re-verify role on EVERY invocation (direct-POST defense).
  await requireRole(['learner'])

  const mentorPublicId = String(formData.get('mentorPublicId') ?? '').trim()
  if (!mentorPublicId) {
    return { error: 'Please choose a mentor.', success: null }
  }

  // (2) Validate the target is a real, ACTIVE mentor alias (DAL — alias only).
  const mentor = await getMentorPublic(mentorPublicId)
  if (!mentor || !mentor.is_active) {
    return { error: 'That mentor is not available. Please pick another.', success: null }
  }

  // (3) Resolve the learner's OWN alias id from the trusted session.
  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) {
    return {
      error: 'Your learner profile is not ready yet. Ask your coordinator for help.',
      success: null,
    }
  }

  const existing = await getOwnChosenMentor()

  // Selecting the mentor you already have, again, is a harmless no-op.
  if (existing && existing.mentor.id === mentorPublicId) {
    return { error: null, success: `${mentor.alias} is already your mentor.` }
  }

  // IMPORTANT (RLS + data integrity): a learner may INSERT their own assignment
  // but may NOT UPDATE existing rows (lma_admin_write is admin-only). So once a
  // learner has a LIVE mentor, switching must go through the admin-mediated
  // change-request flow — otherwise we'd leave two 'active' rows behind. Direct
  // self-service chooseMentor is therefore the INITIAL pick only.
  if (existing) {
    return {
      error:
        'You already have a mentor. To switch, use "Ask to change mentor" — an admin will help you.',
      success: null,
    }
  }

  const supabase = await createClient()

  // First-time pick: insert the learner's own 'active' assignment row.
  const { error } = await supabase.from('learner_mentor_assignments').insert({
    learner_public_id: learnerPublicId,
    mentor_public_id: mentorPublicId,
    status: 'active',
  })

  if (error) {
    return {
      error: 'Could not save your choice right now. Please try again.',
      success: null,
    }
  }

  revalidatePath('/learner')
  revalidatePath('/learner/mentors')
  return { error: null, success: `${mentor.alias} is now your mentor.` }
}

/**
 * Raise a mentor-change request. Escalates to Admin (status 'open'). Records the
 * learner's CURRENT mentor (alias id) as context. A learner may have only one
 * open request at a time.
 *
 * Shaped for useActionState. Re-verifies role internally.
 */
export async function requestMentorChange(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(['learner'])

  const reasonRaw = String(formData.get('reason') ?? '').trim()
  const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 1000) : null

  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) {
    return {
      error: 'Your learner profile is not ready yet. Ask your coordinator for help.',
      success: null,
    }
  }

  // Only one open request at a time.
  if (await hasOpenChangeRequest()) {
    return {
      error: 'You already have a pending request. An admin is reviewing it.',
      success: null,
    }
  }

  const current = await getOwnChosenMentor()
  if (!current) {
    return {
      error: 'Choose a mentor first before asking to change.',
      success: null,
    }
  }

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('mentor_change_requests')
    .insert({
      learner_public_id: learnerPublicId,
      current_mentor_public_id: current.mentor.id,
      reason,
      status: 'open',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    return {
      error: 'Could not send your request right now. Please try again.',
      success: null,
    }
  }

  // Alert the triage owners that a mentor-change request awaits approval
  // (PRD §7.11). No learner identity in the payload — only the request id.
  await notifyAdmins({
    type: 'mentor_change',
    title: 'New mentor-change request',
    body: 'A learner asked to switch mentors. Open the queue to review it.',
    entityType: 'mentor_change_requests',
    entityId: (inserted as { id: string } | null)?.id ?? null,
  })

  revalidatePath('/learner')
  revalidatePath('/learner/mentors')
  return {
    error: null,
    success: 'Your request was sent to an admin. They will help you switch.',
  }
}

'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/mentor/profile/_lib/actions.ts — Mentor self-service Server Actions.
//
// SECURITY (Next.js 16): direct-POST reachable, so EVERY action re-verifies
// requireRole(['mentor']) and resolves the mentor's OWN profile via
// getOwnMentorFull() (RLS-scoped to auth.uid()). A mentor can therefore only
// ever mutate their OWN profile/availability — the profileId is derived from
// the verified session, never from caller-supplied input. The DB RLS
// (mentor_*_self_*) is the backstop.
//
// Mentors edit phone/college/course on their PROFILE and own their availability
// calendar. They do NOT edit their alias or active flag (admin-managed).
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getOwnMentorFull, requireRole } from '@/lib/dal'

export interface ActionResult {
  ok: boolean
  error: string | null
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

/** Null an empty optional text field, else return trimmed value. */
function optional(formData: FormData, name: string): string | null {
  const v = str(formData, name)
  return v.length === 0 ? null : v
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Update the calling mentor's OWN profile contact fields. real_name is NOT
 * editable by the mentor here (it is the canonical identity admins rely on);
 * mentors maintain phone / college / course. Resolves the profile id from the
 * verified session — never from the form.
 */
export async function updateOwnProfile(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['mentor'])

  const mentor = await getOwnMentorFull()
  if (!mentor) {
    return { ok: false, error: 'No mentor profile found for your account.' }
  }

  const phone = optional(formData, 'phone')
  const college = optional(formData, 'college')
  const course = optional(formData, 'course')

  if (phone && phone.length > 30) {
    return { ok: false, error: 'Phone number looks too long.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_profiles')
    .update({ phone, college, course })
    .eq('id', mentor.profileId)

  if (error) {
    return { ok: false, error: 'Could not save your profile.' }
  }

  revalidatePath('/mentor/profile')
  return { ok: true, error: null }
}

/**
 * Add one availability slot for the calling mentor. Date is required; start/end
 * times optional (omit both for an all-day slot). Duplicate (date, start)
 * pairs are rejected by a unique constraint — surfaced as a friendly message.
 */
export async function addAvailability(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['mentor'])

  const mentor = await getOwnMentorFull()
  if (!mentor) {
    return { ok: false, error: 'No mentor profile found for your account.' }
  }

  const availableDate = str(formData, 'availableDate')
  const startTime = optional(formData, 'startTime')
  const endTime = optional(formData, 'endTime')

  if (!DATE_RE.test(availableDate)) {
    return { ok: false, error: 'Choose a valid date.' }
  }
  if (startTime && !TIME_RE.test(startTime)) {
    return { ok: false, error: 'Start time must be HH:MM.' }
  }
  if (endTime && !TIME_RE.test(endTime)) {
    return { ok: false, error: 'End time must be HH:MM.' }
  }
  if (startTime && endTime && endTime <= startTime) {
    return { ok: false, error: 'End time must be after start time.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('mentor_availability').insert({
    mentor_profile_id: mentor.profileId,
    available_date: availableDate,
    start_time: startTime,
    end_time: endTime,
  })

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return {
        ok: false,
        error: 'You already have a slot at that date and start time.',
      }
    }
    return { ok: false, error: 'Could not add availability.' }
  }

  revalidatePath('/mentor/availability')
  revalidatePath('/mentor/profile')
  return { ok: true, error: null }
}

/**
 * Remove one of the calling mentor's availability slots by id. RLS scopes the
 * delete to the mentor's own rows; we additionally constrain the delete to the
 * caller's profileId so a forged id for another mentor's slot is a no-op.
 */
export async function removeAvailability(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['mentor'])

  const mentor = await getOwnMentorFull()
  if (!mentor) {
    return { ok: false, error: 'No mentor profile found for your account.' }
  }

  const slotId = str(formData, 'slotId')
  if (!slotId) {
    return { ok: false, error: 'Missing slot.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_availability')
    .delete()
    .eq('id', slotId)
    .eq('mentor_profile_id', mentor.profileId)

  if (error) {
    return { ok: false, error: 'Could not remove availability.' }
  }

  revalidatePath('/mentor/availability')
  revalidatePath('/mentor/profile')
  return { ok: true, error: null }
}

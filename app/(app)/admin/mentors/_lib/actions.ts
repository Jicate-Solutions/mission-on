'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/mentors/_lib/actions.ts — Admin Server Actions for mentor
// allocation and activation.
//
// SECURITY (Next.js 16): a Server Action is reachable by a DIRECT POST, so a
// page-level gate does NOT protect it. EVERY action here re-verifies
// requireRole(['admin','super_admin']) internally before mutating. Allocation
// and active-state changes run under the admin's RLS context (the
// mentor_*_admin_write policies require is_admin_role()); the explicit
// requireRole is the primary app-layer gate.
//
// We log nothing learner-identifying here. (Role changes / classification /
// safeguarding are the audited categories; mentor allocation is not in the
// AuditAction allow-list, so we do not force a synthetic action.)
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'

import { resolveMentorProfileId } from './queries'

export interface ActionResult {
  ok: boolean
  error: string | null
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

const MAX_NAME = 120
const MAX_FIELD = 120

/**
 * Edit a mentor's REAL profile (real_name + phone/college/course). Admin/
 * super_admin only (RLS mentor_profiles_admin_write backstops). The mentor is
 * identified by mentor_public.id from the form; we resolve it to
 * mentor_profiles.id under the admin guard. Alias is NOT edited here.
 */
export async function updateMentorProfile(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['admin', 'super_admin'])

  const mentorPublicId = str(formData, 'mentorPublicId')
  const realName = str(formData, 'realName').slice(0, MAX_NAME)
  if (!mentorPublicId) return { ok: false, error: 'Missing mentor.' }
  if (realName.length === 0) {
    return { ok: false, error: 'Real name is required.' }
  }

  const mentorProfileId = await resolveMentorProfileId(mentorPublicId)
  if (!mentorProfileId) return { ok: false, error: 'Mentor not found.' }

  const orNull = (name: string): string | null =>
    str(formData, name).slice(0, MAX_FIELD) || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_profiles')
    .update({
      real_name: realName,
      phone: orNull('phone'),
      college: orNull('college'),
      course: orNull('course'),
    })
    .eq('id', mentorProfileId)

  if (error) {
    return { ok: false, error: 'Could not update the profile.' }
  }

  revalidatePath(`/admin/mentors/${mentorPublicId}`)
  revalidatePath(`/super-admin/mentors/${mentorPublicId}`)
  return { ok: true, error: null }
}

/**
 * Allocate a mentor to a school. Idempotent: a unique(mentor_profile_id,
 * school_id) constraint means a re-allocation is a no-op (we treat the unique
 * violation as success). The mentor is identified by mentor_public.id from the
 * form; we resolve it to mentor_profiles.id under the admin guard.
 */
export async function allocateMentorToSchool(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireRole(['admin', 'super_admin'])

  const mentorPublicId = str(formData, 'mentorPublicId')
  const schoolId = str(formData, 'schoolId')
  if (!mentorPublicId || !schoolId) {
    return { ok: false, error: 'Select a mentor and a school.' }
  }

  const mentorProfileId = await resolveMentorProfileId(mentorPublicId)
  if (!mentorProfileId) {
    return { ok: false, error: 'Mentor not found.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('mentor_school_allocations').insert({
    mentor_profile_id: mentorProfileId,
    school_id: schoolId,
    allocated_by: session.userId,
  })

  if (error) {
    // 23505 = unique_violation: already allocated. Treat as success.
    if ((error as { code?: string }).code === '23505') {
      revalidatePath(`/admin/mentors/${mentorPublicId}`)
      return { ok: true, error: null }
    }
    return { ok: false, error: 'Could not allocate mentor to school.' }
  }

  revalidatePath(`/admin/mentors/${mentorPublicId}`)
  return { ok: true, error: null }
}

/**
 * Remove a mentor's allocation to a school by allocation id. mentorPublicId is
 * carried only to revalidate the right page.
 */
export async function removeMentorAllocation(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['admin', 'super_admin'])

  const allocationId = str(formData, 'allocationId')
  const mentorPublicId = str(formData, 'mentorPublicId')
  if (!allocationId) {
    return { ok: false, error: 'Missing allocation.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_school_allocations')
    .delete()
    .eq('id', allocationId)

  if (error) {
    return { ok: false, error: 'Could not remove allocation.' }
  }

  if (mentorPublicId) revalidatePath(`/admin/mentors/${mentorPublicId}`)
  return { ok: true, error: null }
}

/**
 * Activate / deactivate a mentor in the public directory. Deactivating hides
 * the alias from new learner selection (getMentorPublicList default excludes
 * inactive). Operates on mentor_public.id. RLS mentor_public_admin_write
 * requires is_admin_role(); requireRole is the primary gate.
 */
export async function setMentorActive(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['admin', 'super_admin'])

  const mentorPublicId = str(formData, 'mentorPublicId')
  const isActive = str(formData, 'isActive') === 'true'
  if (!mentorPublicId) {
    return { ok: false, error: 'Missing mentor.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_public')
    .update({ is_active: isActive })
    .eq('id', mentorPublicId)

  if (error) {
    return { ok: false, error: 'Could not update mentor status.' }
  }

  revalidatePath('/admin/mentors')
  revalidatePath(`/admin/mentors/${mentorPublicId}`)
  return { ok: true, error: null }
}

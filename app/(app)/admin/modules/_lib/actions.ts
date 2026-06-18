'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/modules/_lib/actions.ts — Admin Server Actions for the Module
// Design Workspace (PRD §7.4).
//
// SECURITY (Next.js 16): a Server Action is reachable by a DIRECT POST, so a
// page-level gate does NOT protect it. EVERY action re-verifies
// requireRole(['admin','super_admin']) internally before mutating. Writes run
// under the admin's RLS context:
//   * session_design — session_design_admin_all requires is_admin_role();
//   * mentor_school_allocations — admin write policy requires is_admin_role().
// The explicit requireRole is the primary app-layer gate.
//
// The "module design" is recorded by UPSERTing session_design (the admin-only
// planning anchor module_code PLUS the delivery-plan brief fields) for a session.
// The mentor team is recorded per-session in session_mentors (0012). The brief
// fields — but never module_code — are exposed to assigned mentors via
// session_brief_v.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type { ModuleCode } from '@/types/database'

import { resolveMentorProfileId } from './queries'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

const MODULE_CODES: ModuleCode[] = [
  'A1-B1',
  'A1-B2',
  'A1-B3',
  'A2-B1',
  'A2-B2',
  'A2-B3',
  'A3-B1',
  'A3-B2',
  'A3-B3',
]

export interface ActionResult {
  ok: boolean
  error: string | null
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Attach (or clear) the planning module code on a session by UPSERTing the
 * admin-only session_design child (keyed by session_id, which is UNIQUE). An
 * empty module code clears the design back to null. ADMIN / SUPER_ADMIN ONLY.
 */
export async function setSessionModuleDesign(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(ADMIN_ROLES)

  const sessionId = str(formData, 'sessionId')
  const rawCode = str(formData, 'moduleCode')
  if (!sessionId) {
    return { ok: false, error: 'Missing session.' }
  }

  let moduleCode: ModuleCode | null = null
  if (rawCode) {
    if (!MODULE_CODES.includes(rawCode as ModuleCode)) {
      return { ok: false, error: 'Invalid module code.' }
    }
    moduleCode = rawCode as ModuleCode
  }

  // Delivery-plan (brief) fields — all free text; empty -> null. These are the
  // fields a mentor may later view via session_brief_v (module_code stays hidden).
  const orNull = (name: string): string | null => str(formData, name) || null

  const supabase = await createClient()
  // session_id is UNIQUE on session_design, so onConflict upsert is idempotent.
  const { error } = await supabase
    .from('session_design')
    .upsert(
      {
        session_id: sessionId,
        module_code: moduleCode,
        media_film: orNull('mediaFilm'),
        demonstration: orNull('demonstration'),
        conversation_framework: orNull('conversationFramework'),
        escalation_pathway: orNull('escalationPathway'),
        learning_facilitator: orNull('learningFacilitator'),
        notes: orNull('notes'),
      },
      { onConflict: 'session_id' }
    )

  if (error) {
    return { ok: false, error: 'Could not save the module design.' }
  }

  revalidatePath('/admin/modules')
  revalidatePath(`/admin/modules/${sessionId}`)
  revalidatePath('/super-admin/modules')
  revalidatePath(`/super-admin/modules/${sessionId}`)
  return { ok: true, error: null }
}

/**
 * Assign a mentor to the design's school by inserting a
 * mentor_school_allocations row (reusing the existing allocation table). The
 * mentor is identified by mentor_public.id; we resolve it to
 * mentor_profiles.id under the admin guard. Idempotent: a duplicate allocation
 * (unique mentor_profile_id+school_id) is treated as success.
 */
export async function assignMentorToSession(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireRole(ADMIN_ROLES)

  const sessionId = str(formData, 'sessionId')
  const mentorPublicId = str(formData, 'mentorPublicId')
  if (!sessionId || !mentorPublicId) {
    return { ok: false, error: 'Select a session and a mentor.' }
  }

  const mentorProfileId = await resolveMentorProfileId(mentorPublicId)
  if (!mentorProfileId) return { ok: false, error: 'Mentor not found.' }

  const supabase = await createClient()
  const { error } = await supabase.from('session_mentors').insert({
    session_id: sessionId,
    mentor_profile_id: mentorProfileId,
    assigned_by: session.userId,
  })

  if (error) {
    // 23505 = unique_violation (session_id+mentor_profile_id): already on the
    // team → treat as success. 23503 = FK violation (bad session) → not found.
    const code = (error as { code?: string }).code
    if (code === '23505') {
      revalidatePath(`/admin/modules/${sessionId}`)
      revalidatePath(`/super-admin/modules/${sessionId}`)
      return { ok: true, error: null }
    }
    if (code === '23503') return { ok: false, error: 'Session not found.' }
    return { ok: false, error: 'Could not assign the mentor.' }
  }

  revalidatePath(`/admin/modules/${sessionId}`)
  revalidatePath(`/super-admin/modules/${sessionId}`)
  return { ok: true, error: null }
}

/**
 * Remove a mentor from the design's school. We resolve the mentor's
 * mentor_profiles.id and delete the matching allocation for the session's
 * school. ADMIN / SUPER_ADMIN ONLY.
 */
export async function unassignMentorFromSession(
  formData: FormData
): Promise<ActionResult> {
  await requireRole(ADMIN_ROLES)

  const sessionId = str(formData, 'sessionId')
  const mentorPublicId = str(formData, 'mentorPublicId')
  if (!sessionId || !mentorPublicId) {
    return { ok: false, error: 'Missing mentor or session.' }
  }

  const mentorProfileId = await resolveMentorProfileId(mentorPublicId)
  if (!mentorProfileId) return { ok: false, error: 'Mentor not found.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('session_mentors')
    .delete()
    .eq('session_id', sessionId)
    .eq('mentor_profile_id', mentorProfileId)

  if (error) {
    return { ok: false, error: 'Could not remove the mentor.' }
  }

  revalidatePath(`/admin/modules/${sessionId}`)
  revalidatePath(`/super-admin/modules/${sessionId}`)
  return { ok: true, error: null }
}

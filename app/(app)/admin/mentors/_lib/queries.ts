import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/mentors/_lib/queries.ts — Admin-only mentor reads.
//
// SECURITY: every function here re-verifies admin/super_admin via
// requireRole(['admin','super_admin']) BEFORE touching the DB. These are the
// ONLY reads in this module that surface real mentor identity, and they are
// reached ONLY from admin route-group pages (themselves gated by the admin
// layout). RLS on mentor_profiles / mentor_availability / mentor_school_-
// allocations is the runtime backstop; this app-layer guard is the primary gate.
//
// We deliberately use the DAL's getMentorFull()/getMentorPublicList() for the
// identity surface (it owns the mentor_profiles join). Availability and
// allocation are mentor-management-owned tables with no identity columns, so we
// read them here following the same auth-re-verify + DTO pattern.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import {
  getMentorFull,
  getMentorPublicList,
  requireRole,
} from '@/lib/dal'
import type { MentorFull, MentorPublic } from '@/types/database'

import type {
  AvailabilitySlot,
  MentorAdminDetail,
  MentorAllocation,
  SchoolOption,
} from './types'

/**
 * List every mentor (alias-only directory entries) for the admin index. We
 * include inactive mentors so admins can manage them. Real identity is NOT
 * loaded here — the index shows alias + active state; the detail page loads
 * full identity on demand. This keeps the heavy mentor_profiles join off the
 * list view.
 */
export async function listMentorsForAdmin(): Promise<MentorPublic[]> {
  await requireRole(['admin', 'super_admin'])
  return getMentorPublicList({ includeInactive: true })
}

/**
 * Read availability slots for a mentor by mentor_profiles.id. Admin-gated.
 * Ordered by date then start time.
 */
async function readAvailability(
  mentorProfileId: string
): Promise<AvailabilitySlot[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_availability')
    .select('id, available_date, start_time, end_time')
    .eq('mentor_profile_id', mentorProfileId)
    .order('available_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    availableDate: r.available_date,
    startTime: r.start_time,
    endTime: r.end_time,
  }))
}

/**
 * Read current school allocations for a mentor by mentor_profiles.id, joined to
 * the school name. Admin-gated.
 */
async function readAllocations(
  mentorProfileId: string
): Promise<MentorAllocation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_school_allocations')
    .select('id, school_id, created_at, schools!inner(name)')
    .eq('mentor_profile_id', mentorProfileId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => {
    const rel = (r as unknown as { schools: { name: string } | { name: string }[] })
      .schools
    const school = Array.isArray(rel) ? rel[0] : rel
    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName: school?.name ?? '(unknown school)',
      createdAt: r.created_at,
    }
  })
}

/**
 * Full admin detail for one mentor (by mentor_public.id): real identity +
 * availability + allocations. Returns null if the mentor does not exist.
 * Admin-gated (getMentorFull throws for non-admins; the explicit requireRole
 * here is belt-and-braces and guards the availability/allocation reads too).
 */
export async function getMentorAdminDetail(
  mentorPublicId: string
): Promise<MentorAdminDetail | null> {
  await requireRole(['admin', 'super_admin'])

  const mentor: MentorFull | null = await getMentorFull(mentorPublicId)
  if (!mentor) return null

  const [availability, allocations] = await Promise.all([
    readAvailability(mentor.profileId),
    readAllocations(mentor.profileId),
  ])

  return { mentor, availability, allocations }
}

/**
 * List schools for the allocation picker. Admin-visible school directory
 * (id + name only — no classification or sensitive columns). Admin-gated.
 */
export async function listSchoolOptions(): Promise<SchoolOption[]> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((s) => ({ id: s.id, name: s.name }))
}

/**
 * Resolve a mentor_public.id -> mentor_profiles.id (admin-gated). Used by the
 * allocation actions, which operate on mentor_profiles.id but receive the
 * public id from the UI. Returns null if not found. Goes through getMentorFull
 * so the profileId resolution itself is admin-guarded.
 */
export async function resolveMentorProfileId(
  mentorPublicId: string
): Promise<string | null> {
  await requireRole(['admin', 'super_admin'])
  const mentor = await getMentorFull(mentorPublicId)
  return mentor?.profileId ?? null
}

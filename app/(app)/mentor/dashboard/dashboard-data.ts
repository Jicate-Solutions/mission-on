import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/mentor/dashboard/dashboard-data.ts — Aggregate reads for the mentor
// home dashboard.
//
// SAFEGUARDING (read before editing):
//   ALIAS-FIRST and SELF-SCOPED. A mentor sees only their own allocations,
//   availability and assigned learners. Learners are surfaced ALIAS-ONLY via the
//   DAL (getLearnerPublicList) — this file NEVER joins learner_profiles and never
//   reads a learner's real identity (that is reveal-on-safeguarding only, through
//   getLearnerFull on a different path). Schools the mentor is allocated to are
//   shown by name only.
//
//   Re-verifies the mentor role internally. RLS scopes every query to the caller
//   (mentor_school_allocations / mentor_availability via mentor_profiles.user_id;
//   learner_mentor_assignments via the assignment's learner ownership chain).
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole, getOwnMentorFull, getLearnerPublicList } from '@/lib/dal'
import type { LearnerPublic, LearnerAssignmentStatus } from '@/types/database'

export interface MentorOverview {
  /** Whether the mentor has set up a profile/alias yet. */
  hasProfile: boolean
  alias: string | null
  isActive: boolean
  assignedSchools: { id: string; name: string }[]
  /** Active learners (alias-only). */
  learners: LearnerPublic[]
  /** Count of upcoming availability slots (today onward). */
  upcomingAvailability: number
  /** Total feedback entries tied to this mentor's alias. */
  feedbackCount: number
}

const ACTIVE_ASSIGNMENT: LearnerAssignmentStatus[] = ['active', 'pending_change']

export async function getMentorOverview(): Promise<MentorOverview> {
  await requireRole(['mentor'])

  const me = await getOwnMentorFull()
  if (!me || !me.profileId) {
    return {
      hasProfile: false,
      alias: null,
      isActive: false,
      assignedSchools: [],
      learners: [],
      upcomingAvailability: 0,
      feedbackCount: 0,
    }
  }

  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  const [allocRes, availRes, assignRes, feedbackRes] = await Promise.all([
    // Allocated schools (join schools for the name only — no classification).
    supabase
      .from('mentor_school_allocations')
      .select('school_id, schools!inner(id, name)')
      .eq('mentor_profile_id', me.profileId),
    // Upcoming availability slots (count only).
    supabase
      .from('mentor_availability')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_profile_id', me.profileId)
      .gte('available_date', todayIso),
    // Active learner assignments -> learner_public ids (alias resolved via DAL).
    supabase
      .from('learner_mentor_assignments')
      .select('learner_public_id, status')
      .eq('mentor_public_id', me.id)
      .in('status', ACTIVE_ASSIGNMENT),
    // Feedback tied to this mentor's alias (count only — never the contents).
    // Reads mentor_feedback_v (0009): mentors no longer have direct SELECT on
    // feedback_responses. The view self-scopes to the caller's aliases.
    supabase
      .from('mentor_feedback_v')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_public_id', me.id),
  ])

  for (const r of [allocRes, availRes, assignRes, feedbackRes]) {
    if (r.error) throw r.error
  }

  // Schools (name only).
  const assignedSchools: { id: string; name: string }[] = []
  for (const row of allocRes.data ?? []) {
    const rel = (row as unknown as {
      schools: { id: string; name: string } | { id: string; name: string }[]
    }).schools
    const school = Array.isArray(rel) ? rel[0] : rel
    if (school) assignedSchools.push({ id: school.id, name: school.name })
  }

  // Resolve learners ALIAS-ONLY via the DAL.
  const learnerIds = (assignRes.data ?? [])
    .map((r) => r.learner_public_id as string)
    .filter(Boolean)
  const learners =
    learnerIds.length > 0 ? await getLearnerPublicList(learnerIds) : []

  return {
    hasProfile: true,
    alias: me.alias || null,
    isActive: me.isActive,
    assignedSchools,
    learners,
    upcomingAvailability: availRes.count ?? 0,
    feedbackCount: feedbackRes.count ?? 0,
  }
}

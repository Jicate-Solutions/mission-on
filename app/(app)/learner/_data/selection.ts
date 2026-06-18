import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/_data/selection.ts — Module-local server-only reads for the
// learner-selection feature.
//
// SAFEGUARDING (read before editing):
//   Every function here re-verifies session+role internally (defense against a
//   direct invocation), and NONE of them ever touch mentor_profiles /
//   learner_profiles real-identity tables on a learner-reachable path. Mentors
//   are surfaced ALIAS-ONLY via the DAL (getMentorPublic / getMentorPublicList);
//   the learner's own identity is read only as their own alias (learner_public)
//   or their own LearnerFull self-view via the DAL.
//
// This file is local to the learner-selection module. It follows the same
// auth-re-verify + DTO boundary pattern as the canonical DAL, and never bypasses
// it. New cross-cutting queries belong in the DAL, not here.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import { getMentorPublic } from '@/lib/dal'
import type {
  LearnerAssignmentStatus,
  MentorChangeStatus,
  MentorPublic,
} from '@/types/database'

/**
 * The calling learner's own learner_public row id (the alias-table id that
 * learner_mentor_assignments.learner_public_id and
 * mentor_change_requests.learner_public_id point at).
 *
 * Resolved by joining learner_public -> learner_profiles on user_id = auth.uid()
 * under RLS (the learner_public_select policy allows a learner to read their own
 * alias row). Returns null if the caller has no learner_public row yet.
 *
 * NOTE: this selects ONLY learner_public.id — never real-identity columns.
 */
export async function getOwnLearnerPublicId(): Promise<string | null> {
  const session = await requireRole(['learner'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_public')
    // alias-table id + the FK we filter on; NO real-identity columns.
    .select('id, learner_profiles!inner(user_id)')
    .eq('learner_profiles.user_id', session.userId)
    .maybeSingle()

  if (error) throw error
  return (data?.id as string | undefined) ?? null
}

/**
 * The calling learner's OWN alias (learner_public.alias), or null if not set up.
 * Alias-only self-view — never reads real_name. Use for the learner's profile
 * header on their home page.
 */
export async function getOwnLearnerAlias(): Promise<string | null> {
  const session = await requireRole(['learner'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_public')
    .select('alias, learner_profiles!inner(user_id)')
    .eq('learner_profiles.user_id', session.userId)
    .maybeSingle()

  if (error) throw error
  return (data?.alias as string | undefined) ?? null
}

/** The learner's currently chosen mentor (ALIAS-ONLY), or null if none active. */
export interface ChosenMentor {
  /** learner_mentor_assignments.id */
  assignmentId: string
  status: LearnerAssignmentStatus
  mentor: MentorPublic
}

/**
 * The calling learner's active (or pending-change) mentor assignment, resolved
 * to an ALIAS-ONLY MentorPublic via the DAL. Returns null if the learner has no
 * live assignment.
 *
 * "Live" = status in ('active','pending_change'); 'reassigned'/'ended' rows are
 * historical and excluded. Reads learner_mentor_assignments under RLS (lma_select
 * lets a learner read their own rows).
 */
export async function getOwnChosenMentor(): Promise<ChosenMentor | null> {
  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_mentor_assignments')
    .select('id, mentor_public_id, status')
    .eq('learner_public_id', learnerPublicId)
    .in('status', ['active', 'pending_change'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // Resolve the mentor as ALIAS-ONLY via the DAL (mentor_public source only).
  const mentor = await getMentorPublic(data.mentor_public_id as string)
  if (!mentor) return null

  return {
    assignmentId: data.id as string,
    status: data.status as LearnerAssignmentStatus,
    mentor,
  }
}

/** One of the learner's own mentor-change requests (alias-free; ids + status). */
export interface OwnChangeRequest {
  id: string
  status: MentorChangeStatus
  reason: string | null
  createdAt: string
}

/**
 * The calling learner's own mentor-change requests, newest first. Used to show
 * a learner whether they already have an open request pending admin review.
 */
export async function getOwnChangeRequests(): Promise<OwnChangeRequest[]> {
  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_change_requests')
    .select('id, status, reason, created_at')
    .eq('learner_public_id', learnerPublicId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    status: r.status as MentorChangeStatus,
    reason: (r.reason as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

/** True when the learner has an open (unresolved) mentor-change request. */
export async function hasOpenChangeRequest(): Promise<boolean> {
  const requests = await getOwnChangeRequests()
  return requests.some((r) => r.status === 'open')
}

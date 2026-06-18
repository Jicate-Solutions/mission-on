import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// mentor-change request queue (admin / super_admin) — server-only data layer.
//
// SECURITY: every function re-verifies requireRole(['admin','super_admin'])
// BEFORE touching the DB (a Server Component render is reachable independently
// of the route-group layout gate). RLS on mentor_change_requests (the admin
// mcr_select path) is the runtime backstop.
//
// CONFIDENTIALITY (end-users are MINORS): this queue shows ALIASES ONLY. We
// join mentor_change_requests -> learner_public (alias), and the current mentor
// -> mentor_public (alias). NEVER surface a learner's or mentor's real name on
// any route reachable from this feature. The admin opens the switch by picking
// a NEW mentor from mentor_public by ALIAS as well.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole, getMentorPublicList } from '@/lib/dal'
import type { MentorChangeStatus, MentorPublic } from '@/types/database'

/** One mentor-change request row for the admin queue — aliases only. */
export interface ChangeRequestItem {
  id: string
  /** learner_public.id of the requester. */
  learnerPublicId: string
  learnerAlias: string
  /** mentor_public.id of the current mentor (may be null if never assigned). */
  currentMentorPublicId: string | null
  currentMentorAlias: string | null
  reason: string | null
  status: MentorChangeStatus
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

/** Shape PostgREST returns for the aliased joins. */
interface RawRequestRow {
  id: string
  learner_public_id: string
  current_mentor_public_id: string | null
  reason: string | null
  status: MentorChangeStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  learner: { alias: string } | { alias: string }[] | null
  current_mentor: { alias: string } | { alias: string }[] | null
}

function one<T>(rel: T | T[] | null): T | null {
  if (rel == null) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

/**
 * List mentor-change requests for the admin queue. Admin / super_admin only.
 * Joins the learner alias (learner_public) and the current mentor alias
 * (mentor_public) — explicit FK-named embeds keep both aliases distinct.
 * Optionally filter by status; default returns every request, newest first.
 */
export async function listChangeRequests(opts?: {
  status?: MentorChangeStatus
}): Promise<ChangeRequestItem[]> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  let query = supabase
    .from('mentor_change_requests')
    .select(
      `id, learner_public_id, current_mentor_public_id, reason, status,
       resolved_by, resolved_at, created_at,
       learner:learner_public(alias),
       current_mentor:mentor_public(alias)`
    )
    .order('created_at', { ascending: false })

  if (opts?.status) {
    query = query.eq('status', opts.status)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as RawRequestRow[]).map((r) => {
    const learner = one(r.learner)
    const currentMentor = one(r.current_mentor)
    return {
      id: r.id,
      learnerPublicId: r.learner_public_id,
      learnerAlias: learner?.alias ?? '(unknown learner)',
      currentMentorPublicId: r.current_mentor_public_id,
      currentMentorAlias: currentMentor?.alias ?? null,
      reason: r.reason,
      status: r.status,
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
    }
  })
}

/**
 * List active mentor aliases for the "switch to" picker. Admin / super_admin
 * only. Alias-only (MentorPublic carries no real identity by type), active
 * mentors only — a learner should not be reassigned to a deactivated mentor.
 */
export async function listMentorOptions(): Promise<MentorPublic[]> {
  await requireRole(['admin', 'super_admin'])
  return getMentorPublicList()
}

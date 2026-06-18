import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/learners/_data/directory.ts — Module-local server-only reads
// for the ADMIN learner directory + mentor-change review.
//
// AUTHORIZATION: every function re-verifies admin/super_admin internally via
// requireRole. These are admin oversight reads (PRD §11 RBAC). They surface
// learners ALIAS-FIRST (learner_public) by default — real identity is NOT joined
// here; admins who need a real name use the DAL's getLearnerFull() on a learner
// detail flow, which is separately gated/audited. This directory is intentionally
// alias-only so the common case never widens minor-PII exposure.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type {
  LearnerAssignmentStatus,
  MentorChangeStatus,
} from '@/types/database'

/** One learner row in the admin directory (ALIAS-ONLY + their mentor alias). */
export interface LearnerDirectoryRow {
  learnerPublicId: string
  learnerAlias: string
  /** The learner's live mentor (alias), or null if unassigned. */
  mentorPublicId: string | null
  mentorAlias: string | null
  assignmentStatus: LearnerAssignmentStatus | null
}

/**
 * Admin learner directory: every learner_public row, joined to their live
 * (active/pending_change) assignment and that mentor's alias. ALIAS-ONLY — no
 * real_name anywhere. Ordered by learner alias.
 */
export async function getLearnerDirectory(): Promise<LearnerDirectoryRow[]> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()

  // 1) All learner aliases (admin sees all via learner_public_select / is_admin).
  const { data: learners, error: lErr } = await supabase
    .from('learner_public')
    .select('id, alias')
    .order('alias', { ascending: true })
  if (lErr) throw lErr

  const learnerRows = (learners ?? []) as { id: string; alias: string }[]
  if (learnerRows.length === 0) return []

  // 2) Live assignments for those learners (admin reads all via lma_select).
  const { data: assignments, error: aErr } = await supabase
    .from('learner_mentor_assignments')
    .select('learner_public_id, mentor_public_id, status, created_at')
    .in(
      'learner_public_id',
      learnerRows.map((l) => l.id)
    )
    .in('status', ['active', 'pending_change'])
    .order('created_at', { ascending: false })
  if (aErr) throw aErr

  // 3) Mentor aliases for the assigned mentors (mentor_public — alias only).
  const mentorIds = Array.from(
    new Set(
      (assignments ?? []).map((a) => a.mentor_public_id as string)
    )
  )
  const mentorAliasById = new Map<string, string>()
  if (mentorIds.length > 0) {
    const { data: mentors, error: mErr } = await supabase
      .from('mentor_public')
      .select('id, alias')
      .in('id', mentorIds)
    if (mErr) throw mErr
    for (const m of mentors ?? []) {
      mentorAliasById.set(m.id as string, m.alias as string)
    }
  }

  // Keep only the newest live assignment per learner.
  const liveByLearner = new Map<
    string,
    { mentor_public_id: string; status: LearnerAssignmentStatus }
  >()
  for (const a of assignments ?? []) {
    const key = a.learner_public_id as string
    if (!liveByLearner.has(key)) {
      liveByLearner.set(key, {
        mentor_public_id: a.mentor_public_id as string,
        status: a.status as LearnerAssignmentStatus,
      })
    }
  }

  return learnerRows.map((l) => {
    const live = liveByLearner.get(l.id)
    return {
      learnerPublicId: l.id,
      learnerAlias: l.alias,
      mentorPublicId: live?.mentor_public_id ?? null,
      mentorAlias: live
        ? mentorAliasById.get(live.mentor_public_id) ?? null
        : null,
      assignmentStatus: live?.status ?? null,
    }
  })
}

/** One mentor-change request in the admin review queue (ALIAS-ONLY). */
export interface ChangeRequestRow {
  id: string
  learnerPublicId: string
  learnerAlias: string | null
  currentMentorPublicId: string | null
  currentMentorAlias: string | null
  reason: string | null
  status: MentorChangeStatus
  createdAt: string
  resolvedAt: string | null
}

/**
 * Mentor-change requests for the admin queue. Pass `onlyOpen` to restrict to the
 * actionable (status='open') set. ALIAS-ONLY — learner and current-mentor are
 * shown by alias; no real identity is read.
 */
export async function getChangeRequests(opts?: {
  onlyOpen?: boolean
}): Promise<ChangeRequestRow[]> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  let query = supabase
    .from('mentor_change_requests')
    .select(
      'id, learner_public_id, current_mentor_public_id, reason, status, created_at, resolved_at'
    )
    .order('created_at', { ascending: false })

  if (opts?.onlyOpen) query = query.eq('status', 'open')

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    learner_public_id: string
    current_mentor_public_id: string | null
    reason: string | null
    status: MentorChangeStatus
    created_at: string
    resolved_at: string | null
  }[]
  if (rows.length === 0) return []

  // Resolve learner + mentor aliases in batch (alias tables only).
  const learnerIds = Array.from(new Set(rows.map((r) => r.learner_public_id)))
  const mentorIds = Array.from(
    new Set(
      rows
        .map((r) => r.current_mentor_public_id)
        .filter((v): v is string => v !== null)
    )
  )

  const learnerAliasById = new Map<string, string>()
  if (learnerIds.length > 0) {
    const { data: la, error: laErr } = await supabase
      .from('learner_public')
      .select('id, alias')
      .in('id', learnerIds)
    if (laErr) throw laErr
    for (const l of la ?? []) learnerAliasById.set(l.id as string, l.alias as string)
  }

  const mentorAliasById = new Map<string, string>()
  if (mentorIds.length > 0) {
    const { data: ma, error: maErr } = await supabase
      .from('mentor_public')
      .select('id, alias')
      .in('id', mentorIds)
    if (maErr) throw maErr
    for (const m of ma ?? []) mentorAliasById.set(m.id as string, m.alias as string)
  }

  return rows.map((r) => ({
    id: r.id,
    learnerPublicId: r.learner_public_id,
    learnerAlias: learnerAliasById.get(r.learner_public_id) ?? null,
    currentMentorPublicId: r.current_mentor_public_id,
    currentMentorAlias: r.current_mentor_public_id
      ? mentorAliasById.get(r.current_mentor_public_id) ?? null
      : null,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }))
}
